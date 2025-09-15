package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.Invoice;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgingReportDTO {
    private BigDecimal current;
    private BigDecimal days1To30;
    private BigDecimal days31To60;
    private BigDecimal days61To90;
    private BigDecimal over90Days;
    private BigDecimal total;
    private LocalDate generatedDate;
    private Map<String, List<Invoice>> invoicesByAging;
}