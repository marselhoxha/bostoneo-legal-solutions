package com.***REMOVED***.***REMOVED***solutions.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class EnumValidator implements ConstraintValidator<ValidEnum, Object> {
    private Class<? extends Enum<?>> enumClass;

    @Override
    public void initialize(ValidEnum constraintAnnotation) {
        enumClass = constraintAnnotation.enumClass();
    }

    @Override
    public boolean isValid(Object value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }

        // If the value is already an enum of the correct type, it's valid
        if (enumClass.isInstance(value)) {
            return true;
        }

        // If the value is a String, check if it matches any enum constant name
        if (value instanceof String) {
            try {
                Enum<?>[] enumValues = enumClass.getEnumConstants();
                for (Enum<?> enumValue : enumValues) {
                    if (enumValue.name().equals(value)) {
                        return true;
                    }
                }
                return false;
            } catch (Exception e) {
                return false;
            }
        }

        return false;
    }
} 