package com.example.tasks;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Single-file Spring Boot application with MongoDB backend
 * for managing Tasks and TaskExecutions.
 */
@SpringBootApplication
public class KaiburrTasksApplication {
    public static void main(String[] args) {
        SpringApplication.run(KaiburrTasksApplication.class, args);
    }
}

/* ============================ MODELS ============================ */

@Document(collection = "tasks")
class Task {
    @Id
    private String id;
    private String name;
    private String owner;
    private String command;
    private List<TaskExecution> taskExecutions = new ArrayList<>();

    public Task() {}

    public Task(String id, String name, String owner, String command) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.command = command;
    }

    // Getters & setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getCommand() { return command; }
    public void setCommand(String command) { this.command = command; }
    public List<TaskExecution> getTaskExecutions() { return taskExecutions; }
    public void setTaskExecutions(List<TaskExecution> taskExecutions) { this.taskExecutions = taskExecutions; }
}

class TaskExecution {
    private Instant startTime;
    private Instant endTime;
    private String output;

    public TaskExecution() {}

    public TaskExecution(Instant startTime, Instant endTime, String output) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.output = output;
    }

    // Getters & setters
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }
}

/* ============================ REPOSITORY ============================ */

interface TaskRepository extends MongoRepository<Task, String> {
    List<Task> findByNameContainingIgnoreCase(String name);
}

/* ============================ SERVICE ============================ */

@Service
class TaskService {
    private final TaskRepository repo;

    public TaskService(TaskRepository repo) {
        this.repo = repo;
    }

    public List<Task> getAllTasks() {
        return repo.findAll();
    }

    public Optional<Task> getTaskById(String id) {
        return repo.findById(id);
    }

    public Task saveTask(Task task) {
        if (!isSafeCommand(task.getCommand())) {
            throw new IllegalArgumentException("Unsafe command detected!");
        }
        return repo.save(task);
    }

    public void deleteTask(String id) {
        repo.deleteById(id);
    }

    public List<Task> findTasksByName(String name) {
        return repo.findByNameContainingIgnoreCase(name);
    }

    public TaskExecution executeTask(String taskId) throws Exception {
        Task task = repo.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        if (!isSafeCommand(task.getCommand())) {
            throw new IllegalArgumentException("Unsafe command detected!");
        }

        Instant start = Instant.now();
        Process proc = Runtime.getRuntime().exec(task.getCommand());

        BufferedReader reader = new BufferedReader(new InputStreamReader(proc.getInputStream()));
        StringBuilder output = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            output.append(line).append("\n");
        }
        proc.waitFor();
        Instant end = Instant.now();

        TaskExecution exec = new TaskExecution(start, end, output.toString().trim());
        task.getTaskExecutions().add(exec);
        repo.save(task);

        return exec;
    }

    /** Very simple validation: only allow 'echo' commands. */
    private boolean isSafeCommand(String command) {
        return command != null && command.trim().startsWith("echo ");
    }
}

/* ============================ CONTROLLER ============================ */

@RestController
@RequestMapping("/tasks")
class TaskController {
    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    // GET /tasks
    @GetMapping
    public ResponseEntity<?> getTasks(@RequestParam(required = false) String id) {
        if (id != null) {
            return service.getTaskById(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        return ResponseEntity.ok(service.getAllTasks());
    }

    // PUT /tasks
    @PutMapping
    public ResponseEntity<?> createTask(@RequestBody Task task) {
        try {
            Task saved = service.saveTask(task);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // DELETE /tasks/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable String id) {
        service.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    // GET /tasks/search?name=abc
    @GetMapping("/search")
    public ResponseEntity<?> searchTasks(@RequestParam String name) {
        List<Task> found = service.findTasksByName(name);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(found);
    }

    // PUT /tasks/{id}/execute
    @PutMapping("/{id}/execute")
    public ResponseEntity<?> executeTask(@PathVariable String id) {
        try {
            TaskExecution exec = service.executeTask(id);
            return ResponseEntity.ok(exec);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
