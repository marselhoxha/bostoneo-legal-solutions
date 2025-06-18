package com.***REMOVED***.***REMOVED***solutions.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.FIELD, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RoleBasedAccess {
    String[] roles() default {};
    boolean hideForRoles() default false; // If true, hide for specified roles; if false, show only for specified roles
} 