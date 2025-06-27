package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.TaskComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {
    
    /**
     * Find comments for a task
     */
    @Query("SELECT tc FROM TaskComment tc WHERE tc.task.id = :taskId " +
           "ORDER BY tc.createdAt DESC")
    List<TaskComment> findByTaskId(@Param("taskId") Long taskId);
    
    /**
     * Find comments by user
     */
    @Query("SELECT tc FROM TaskComment tc WHERE tc.user.id = :userId " +
           "ORDER BY tc.createdAt DESC")
    List<TaskComment> findByUserId(@Param("userId") Long userId);
    
    /**
     * Find public comments for a task (not internal)
     */
    @Query("SELECT tc FROM TaskComment tc WHERE tc.task.id = :taskId " +
           "AND tc.internal = false ORDER BY tc.createdAt DESC")
    List<TaskComment> findPublicCommentsByTaskId(@Param("taskId") Long taskId);
    
    /**
     * Find recent comments
     */
    @Query("SELECT tc FROM TaskComment tc WHERE tc.createdAt >= :since " +
           "ORDER BY tc.createdAt DESC")
    List<TaskComment> findRecentComments(@Param("since") LocalDateTime since);
    
    /**
     * Count comments for a task
     */
    @Query("SELECT COUNT(tc) FROM TaskComment tc WHERE tc.task.id = :taskId")
    long countByTaskId(@Param("taskId") Long taskId);
    
    /**
     * Find comments with attachments
     */
    @Query("SELECT tc FROM TaskComment tc WHERE tc.attachmentUrl IS NOT NULL " +
           "AND tc.task.id = :taskId")
    List<TaskComment> findCommentsWithAttachments(@Param("taskId") Long taskId);
}