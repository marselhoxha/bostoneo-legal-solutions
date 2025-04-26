package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class ExpenseCategoryDTO {
    private Long id;
    private String name;
    private String color;
    private Long parentId;
    private String parentName;
    private Date createdAt;
    private Date updatedAt;
} 