package com.bostoneo.bostoneosolutions.repository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
@Slf4j
public class DemoRequestRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static final String INSERT_DEMO_REQUEST = """
        INSERT INTO demo_requests (name, email, firm_name, firm_size, practice_areas, phone, message)
        VALUES (:name, :email, :firmName, :firmSize, :practiceAreas, :phone, :message)
        """;

    public void save(String name, String email, String firmName, String firmSize,
                     List<String> practiceAreas, String phone, String message) {
        var params = new MapSqlParameterSource()
                .addValue("name", name)
                .addValue("email", email)
                .addValue("firmName", firmName)
                .addValue("firmSize", firmSize)
                .addValue("practiceAreas", String.join(",", practiceAreas))
                .addValue("phone", phone)
                .addValue("message", message);

        jdbc.update(INSERT_DEMO_REQUEST, params);
        log.info("Demo request saved for: {} ({})", name, email);
    }
}
