package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StationeryRenderResponse {
    private String letterheadHtml;
    private String signatureBlockHtml;
    private String footerHtml;
}
