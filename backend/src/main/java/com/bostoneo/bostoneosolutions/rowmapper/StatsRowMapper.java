package com.***REMOVED***.***REMOVED***solutions.rowmapper;

import com.***REMOVED***.***REMOVED***solutions.model.Stats;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class StatsRowMapper  implements RowMapper<Stats> {

    @Override
    public Stats mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        return Stats.builder()
                .totalCustomers(resultSet.getInt("total_customers"))
                .totalInvoices(resultSet.getInt("total_invoices"))
                .totalBilled(resultSet.getDouble("total_billed"))
                .build();
    }
}
