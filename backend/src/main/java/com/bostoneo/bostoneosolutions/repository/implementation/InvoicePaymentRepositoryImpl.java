package com.bostoneo.bostoneosolutions.repository.implementation;

import com.bostoneo.bostoneosolutions.dto.InvoicePaymentDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;
import com.bostoneo.bostoneosolutions.repository.InvoicePaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.bostoneo.bostoneosolutions.query.InvoicePaymentQuery.*;

@Repository
@RequiredArgsConstructor
@Slf4j
public class InvoicePaymentRepositoryImpl implements InvoicePaymentRepository<InvoicePayment> {
    
    private final NamedParameterJdbcTemplate jdbc;

    @Override
    public InvoicePayment create(InvoicePayment payment) {
        try {
            KeyHolder holder = new GeneratedKeyHolder();
            SqlParameterSource parameters = new MapSqlParameterSource()
                    .addValue("invoiceId", payment.getInvoiceId())
                    .addValue("paymentDate", payment.getPaymentDate())
                    .addValue("amount", payment.getAmount())
                    .addValue("paymentMethod", payment.getPaymentMethod())
                    .addValue("referenceNumber", payment.getReferenceNumber())
                    .addValue("notes", payment.getNotes())
                    .addValue("createdBy", payment.getCreatedBy());
            
            jdbc.update(INSERT_PAYMENT_QUERY, parameters, holder);
            payment.setId(holder.getKey().longValue());
            log.info("Created payment for invoice ID: {}", payment.getInvoiceId());
            return payment;
        } catch (DataAccessException exception) {
            log.error("Error creating payment: {}", exception.getMessage());
            throw new ApiException("Error creating payment");
        }
    }

    @Override
    public Optional<InvoicePayment> get(Long id) {
        try {
            SqlParameterSource parameters = new MapSqlParameterSource("id", id);
            InvoicePayment payment = jdbc.queryForObject(SELECT_PAYMENT_BY_ID_QUERY, parameters, 
                (rs, rowNum) -> InvoicePayment.builder()
                    .id(rs.getLong("id"))
                    .invoiceId(rs.getLong("invoice_id"))
                    .paymentDate(rs.getDate("payment_date").toLocalDate())
                    .amount(rs.getBigDecimal("amount"))
                    .paymentMethod(rs.getString("payment_method"))
                    .referenceNumber(rs.getString("reference_number"))
                    .notes(rs.getString("notes"))
                    .createdBy(rs.getLong("created_by"))
                    .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                    .updatedAt(rs.getTimestamp("updated_at").toLocalDateTime())
                    .build()
            );
            return Optional.of(payment);
        } catch (Exception exception) {
            log.error("Error retrieving payment by id: {}", id);
            return Optional.empty();
        }
    }

    @Override
    public List<InvoicePaymentDTO> findByInvoiceId(Long invoiceId) {
        try {
            SqlParameterSource parameters = new MapSqlParameterSource("invoiceId", invoiceId);
            return jdbc.query(SELECT_PAYMENTS_BY_INVOICE_ID_QUERY, parameters, 
                (rs, rowNum) -> InvoicePaymentDTO.builder()
                    .id(rs.getLong("id"))
                    .invoiceId(rs.getLong("invoice_id"))
                    .paymentDate(rs.getDate("payment_date").toLocalDate())
                    .amount(rs.getBigDecimal("amount"))
                    .paymentMethod(rs.getString("payment_method"))
                    .referenceNumber(rs.getString("reference_number"))
                    .notes(rs.getString("notes"))
                    .createdBy(rs.getLong("created_by"))
                    .createdByName(rs.getString("created_by_name"))
                    .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                    .build()
            );
        } catch (Exception exception) {
            log.error("Error retrieving payments for invoice: {}", invoiceId);
            throw new ApiException("Error retrieving payments");
        }
    }

    @Override
    public BigDecimal getTotalPaymentsByInvoiceId(Long invoiceId) {
        try {
            SqlParameterSource parameters = new MapSqlParameterSource("invoiceId", invoiceId);
            BigDecimal total = jdbc.queryForObject(GET_TOTAL_PAYMENTS_BY_INVOICE_QUERY, parameters, BigDecimal.class);
            return total != null ? total : BigDecimal.ZERO;
        } catch (Exception exception) {
            log.error("Error calculating total payments for invoice: {}", invoiceId);
            return BigDecimal.ZERO;
        }
    }

    @Override
    public void delete(Long id) {
        try {
            SqlParameterSource parameters = new MapSqlParameterSource("id", id);
            jdbc.update(DELETE_PAYMENT_QUERY, parameters);
            log.info("Deleted payment with id: {}", id);
        } catch (Exception exception) {
            log.error("Error deleting payment: {}", id);
            throw new ApiException("Error deleting payment");
        }
    }

    @Override
    public List<InvoicePaymentDTO> findRecentPayments(int limit) {
        try {
            SqlParameterSource parameters = new MapSqlParameterSource("limit", limit);
            return jdbc.query(SELECT_RECENT_PAYMENTS_QUERY, parameters,
                (rs, rowNum) -> InvoicePaymentDTO.builder()
                    .id(rs.getLong("id"))
                    .invoiceId(rs.getLong("invoice_id"))
                    .invoiceNumber(rs.getString("invoice_number"))
                    .clientName(rs.getString("client_name"))
                    .paymentDate(rs.getDate("payment_date").toLocalDate())
                    .amount(rs.getBigDecimal("amount"))
                    .paymentMethod(rs.getString("payment_method"))
                    .referenceNumber(rs.getString("reference_number"))
                    .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                    .build()
            );
        } catch (Exception exception) {
            log.error("Error retrieving recent payments");
            throw new ApiException("Error retrieving recent payments");
        }
    }

    @Override
    public BigDecimal getTotalPaymentsByDateRange(String startDate, String endDate) {
        try {
            SqlParameterSource parameters = new MapSqlParameterSource()
                    .addValue("startDate", startDate)
                    .addValue("endDate", endDate);
            BigDecimal total = jdbc.queryForObject(GET_TOTAL_PAYMENTS_BY_DATE_RANGE_QUERY, parameters, BigDecimal.class);
            return total != null ? total : BigDecimal.ZERO;
        } catch (Exception exception) {
            log.error("Error calculating total payments for date range");
            return BigDecimal.ZERO;
        }
    }
}