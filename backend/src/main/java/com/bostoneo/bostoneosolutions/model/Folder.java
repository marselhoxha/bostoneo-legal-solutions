package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "folders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Folder {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;
    
    @Column(name = "name", nullable = false, length = 255)
    private String name;
    
    @Column(name = "parent_folder_id")
    private Long parentFolderId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_folder_id", insertable = false, updatable = false)
    private Folder parentFolder;
    
    @OneToMany(mappedBy = "parentFolder", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Folder> subFolders;
    
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(name = "deleted", nullable = false)
    @Builder.Default
    private Boolean deleted = false;
    
    // Case integration fields
    @Column(name = "case_id")
    private Long caseId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", insertable = false, updatable = false)
    private LegalCase legalCase;
    
    @Column(name = "department_id")
    private Long departmentId;
    
    @Column(name = "practice_area", length = 100)
    private String practiceArea;
    
    @Column(name = "folder_type", length = 50)
    private String folderType;
    
    @Column(name = "is_template", nullable = false)
    @Builder.Default
    private Boolean isTemplate = false;
    
    // Relationships
    @OneToMany(mappedBy = "folder", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FileItem> files;
    
    // Helper methods
    public String getFullPath() {
        if (parentFolder != null) {
            return parentFolder.getFullPath() + "/" + name;
        }
        return name;
    }
    
    public int getDepth() {
        if (parentFolder != null) {
            return parentFolder.getDepth() + 1;
        }
        return 0;
    }
    
    public boolean isRootFolder() {
        return parentFolder == null;
    }
}