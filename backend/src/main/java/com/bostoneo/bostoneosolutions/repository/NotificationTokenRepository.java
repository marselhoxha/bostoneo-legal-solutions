package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.NotificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationTokenRepository extends JpaRepository<NotificationToken, Long> {
    
    /**
     * Find a token by its value
     */
    Optional<NotificationToken> findByToken(String token);
    
    /**
     * Find all tokens for a specific user
     */
    List<NotificationToken> findByUserId(Long userId);
    
    /**
     * Find all tokens for a specific user and platform
     */
    List<NotificationToken> findByUserIdAndPlatform(Long userId, String platform);
    
} 
 