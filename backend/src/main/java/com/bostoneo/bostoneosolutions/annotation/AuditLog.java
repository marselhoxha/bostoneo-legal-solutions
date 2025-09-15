package com.bostoneo.bostoneosolutions.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to mark methods for automatic audit logging
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLog {
    
    /**
     * The action being performed (CREATE, UPDATE, DELETE, VIEW, etc.)
     */
    String action() default "";
    
    /**
     * The entity type being acted upon (CUSTOMER, CASE, DOCUMENT, etc.)
     */
    String entityType() default "";
    
    /**
     * Description of the action
     */
    String description() default "";
    
    /**
     * Whether to include method parameters in metadata
     */
    boolean includeParams() default true;
    
    /**
     * Whether to include return value in metadata
     */
    boolean includeResult() default false;
} 
 
 
 
 
 
 