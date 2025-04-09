package com.bostoneo.bostoneosolutions.report;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Customer;
import com.bostoneo.bostoneosolutions.model.Invoice;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.InputStreamResource;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static java.util.stream.IntStream.range;
import static org.apache.commons.lang3.time.DateFormatUtils.format;
@Slf4j
public class InvoiceReport {
    public static final String DATE_FORMATTER = "yyyy-MM-dd hh:mm:ss";
    private XSSFWorkbook workbook;
    private XSSFSheet sheet;
    private List<Invoice> invoices;
    private static String[] HEADERS = { "ID", "Date", "Invoice Number", "Services", "Status", "Total", "Customer ID"};


   public InvoiceReport(List<Invoice> invoices) {
        this.invoices = invoices;
        workbook = new XSSFWorkbook();
        sheet = workbook.createSheet("Invoices");
        setHeaders();
    }

    private void setHeaders() {
        Row headerRow = sheet.createRow(0);
        CellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setBold(true);
        font.setFontHeight(14);
        style.setFont(font);
        range(0, HEADERS.length).forEach(index -> {
            Cell cell = headerRow.createCell(index);
            cell.setCellValue(HEADERS[index]);
            cell.setCellStyle(style);
        });
    }

    public InputStreamResource exportInvoiceReport() {

       return generateInvoiceReport();
    }

    private InputStreamResource generateInvoiceReport() {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle style = workbook.createCellStyle();
            XSSFFont font = workbook.createFont();
            font.setFontHeight(10);
            style.setFont(font);
            int rowIndex = 1;
            for(Invoice invoice: invoices) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue(invoice.getId());
                row.createCell(1).setCellValue(format(invoice.getDate(), DATE_FORMATTER));
                row.createCell(2).setCellValue(invoice.getInvoiceNumber());
                row.createCell(3).setCellValue(invoice.getServices());
                row.createCell(4).setCellValue(invoice.getStatus());
                row.createCell(5).setCellValue(invoice.getTotal());
                row.createCell(6).setCellValue(invoice.getCustomer().getId());

            }
            workbook.write(out);
            return new InputStreamResource(new ByteArrayInputStream(out.toByteArray()));
        } catch (Exception exception) {
            log.error(exception.getMessage());
            throw new ApiException("Unable to export report file");
        }
    }
}
