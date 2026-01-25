package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.FetchType.LAZY;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "expense_categories")
public class ExpenseCategory {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "color", nullable = false, length = 20)
    private String color;

    @ManyToOne(fetch = LAZY)
    @JoinColumn(name = "parent_id")
    @JsonBackReference
    private ExpenseCategory parent;

    @OneToMany(mappedBy = "parent", fetch = LAZY)
    @JsonManagedReference
    private Set<ExpenseCategory> children = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        updatedAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
} 