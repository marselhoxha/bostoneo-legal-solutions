-- Add more comprehensive I-130 field mappings for thorough testing

-- Get the I-130 template ID
SET @i130_template_id = (SELECT id FROM ai_legal_templates WHERE name LIKE '%I-130%' AND template_type = 'PDF_FORM' LIMIT 1);

-- Insert additional field mappings for comprehensive testing
INSERT INTO ai_pdf_form_fields (
    template_id, pdf_field_name, case_data_path, field_type,
    is_required, display_order, created_at
) VALUES

-- Petitioner Additional Information (Part 2)
(@i130_template_id, 'form1[0].#subform[0].#area[4].Pt2Line1_AlienNumber[0]', 'petitionerAlienNumber', 'TEXT', FALSE, 21, NOW()),
(@i130_template_id, 'form1[0].#subform[0].#area[5].Pt2Line2_USCISOnlineActNumber[0]', 'petitionerUSCISAccount', 'TEXT', FALSE, 22, NOW()),
(@i130_template_id, 'form1[0].#subform[0].Pt2Line11_SSN[0]', 'petitionerSSN', 'TEXT', TRUE, 23, NOW()),

-- Petitioner Names and Birth Info (Part 2 continued)
(@i130_template_id, 'form1[0].#subform[1].Pt2Line5a_FamilyName[0]', 'petitionerOtherLastName', 'TEXT', FALSE, 24, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line5b_GivenName[0]', 'petitionerOtherFirstName', 'TEXT', FALSE, 25, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line5c_MiddleName[0]', 'petitionerOtherMiddleName', 'TEXT', FALSE, 26, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line6_CityTownOfBirth[0]', 'petitionerCityOfBirth', 'TEXT', TRUE, 27, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line7_CountryofBirth[0]', 'petitionerCountryOfBirth', 'TEXT', TRUE, 28, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line8_DateofBirth[0]', 'petitionerDateOfBirth', 'DATE', TRUE, 29, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line9_Male[0]', 'petitionerGenderMale', 'CHECKBOX', FALSE, 30, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line9_Female[0]', 'petitionerGenderFemale', 'CHECKBOX', FALSE, 31, NOW()),

-- Petitioner Address (Part 2)
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_StreetNumberName[0]', 'petitionerStreetAddress', 'TEXT', TRUE, 32, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_AptSteFlrNumber[0]', 'petitionerApartmentNumber', 'TEXT', FALSE, 33, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_CityOrTown[0]', 'petitionerCity', 'TEXT', TRUE, 34, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_State[0]', 'petitionerState', 'TEXT', FALSE, 35, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_ZipCode[0]', 'petitionerZipCode', 'TEXT', FALSE, 36, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_Province[0]', 'petitionerProvince', 'TEXT', FALSE, 37, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_PostalCode[0]', 'petitionerPostalCode', 'TEXT', FALSE, 38, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line10_Country[0]', 'petitionerCountry', 'TEXT', TRUE, 39, NOW()),

-- Petitioner Marital Status (Part 2)
(@i130_template_id, 'form1[0].#subform[1].Pt2Line16_NumberofMarriages[0]', 'petitionerNumberOfMarriages', 'TEXT', FALSE, 40, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line17_Single[0]', 'petitionerMaritalStatusSingle', 'CHECKBOX', FALSE, 41, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line17_Married[0]', 'petitionerMaritalStatusMarried', 'CHECKBOX', FALSE, 42, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line17_Divorced[0]', 'petitionerMaritalStatusDivorced', 'CHECKBOX', FALSE, 43, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line17_Widowed[0]', 'petitionerMaritalStatusWidowed', 'CHECKBOX', FALSE, 44, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line17_Separated[0]', 'petitionerMaritalStatusSeparated', 'CHECKBOX', FALSE, 45, NOW()),
(@i130_template_id, 'form1[0].#subform[1].Pt2Line17_Annulled[0]', 'petitionerMaritalStatusAnnulled', 'CHECKBOX', FALSE, 46, NOW()),

-- Petitioner Marriage Information (Part 2)
(@i130_template_id, 'form1[0].#subform[2].Pt2Line18_DateOfMarriage[0]', 'petitionerCurrentMarriageDate', 'DATE', FALSE, 47, NOW()),
(@i130_template_id, 'form1[0].#subform[2].Pt2Line19a_CityTown[0]', 'petitionerMarriageCity', 'TEXT', FALSE, 48, NOW()),
(@i130_template_id, 'form1[0].#subform[2].Pt2Line19b_State[0]', 'petitionerMarriageState', 'TEXT', FALSE, 49, NOW()),
(@i130_template_id, 'form1[0].#subform[2].Pt2Line19d_Country[0]', 'petitionerMarriageCountry', 'TEXT', FALSE, 50, NOW()),

-- Beneficiary Additional Information (Part 4)
(@i130_template_id, 'form1[0].#subform[4].#area[6].Pt4Line1_AlienNumber[0]', 'beneficiaryAlienNumber', 'TEXT', FALSE, 51, NOW()),
(@i130_template_id, 'form1[0].#subform[4].#area[7].Pt4Line2_USCISOnlineActNumber[0]', 'beneficiaryUSCISAccount', 'TEXT', FALSE, 52, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line3_SSN[0]', 'beneficiarySSN', 'TEXT', FALSE, 53, NOW()),

-- Beneficiary Other Names (Part 4)
(@i130_template_id, 'form1[0].#subform[4].P4Line5a_FamilyName[0]', 'beneficiaryOtherLastName', 'TEXT', FALSE, 54, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line5b_GivenName[0]', 'beneficiaryOtherFirstName', 'TEXT', FALSE, 55, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line5c_MiddleName[0]', 'beneficiaryOtherMiddleName', 'TEXT', FALSE, 56, NOW()),

-- Beneficiary Physical Address (Part 4)
(@i130_template_id, 'form1[0].#subform[4].Pt4Line12a_StreetNumberName[0]', 'beneficiaryPhysicalAddress', 'TEXT', FALSE, 57, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line12b_AptSteFlrNumber[0]', 'beneficiaryPhysicalApartment', 'TEXT', FALSE, 58, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line12c_CityOrTown[0]', 'beneficiaryPhysicalCity', 'TEXT', FALSE, 59, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line12d_State[0]', 'beneficiaryPhysicalState', 'TEXT', FALSE, 60, NOW()),
(@i130_template_id, 'form1[0].#subform[4].Pt4Line12e_ZipCode[0]', 'beneficiaryPhysicalZipCode', 'TEXT', FALSE, 61, NOW()),

-- Beneficiary Contact Information (Part 4)
(@i130_template_id, 'form1[0].#subform[4].Pt4Line14_DaytimePhoneNumber[0]', 'beneficiaryDaytimePhone', 'TEXT', FALSE, 62, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line15_MobilePhoneNumber[0]', 'beneficiaryMobilePhone', 'TEXT', FALSE, 63, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line16_EmailAddress[0]', 'beneficiaryEmail', 'TEXT', FALSE, 64, NOW()),

-- Beneficiary Marital Status (Part 4)
(@i130_template_id, 'form1[0].#subform[5].Pt4Line17_NumberofMarriages[0]', 'beneficiaryNumberOfMarriages', 'TEXT', FALSE, 65, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line18_MaritalStatus[0]', 'beneficiaryMaritalStatusSingle', 'CHECKBOX', FALSE, 66, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line18_MaritalStatus[1]', 'beneficiaryMaritalStatusMarried', 'CHECKBOX', FALSE, 67, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line18_MaritalStatus[2]', 'beneficiaryMaritalStatusDivorced', 'CHECKBOX', FALSE, 68, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line18_MaritalStatus[3]', 'beneficiaryMaritalStatusWidowed', 'CHECKBOX', FALSE, 69, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line18_MaritalStatus[4]', 'beneficiaryMaritalStatusSeparated', 'CHECKBOX', FALSE, 70, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line18_MaritalStatus[5]', 'beneficiaryMaritalStatusAnnulled', 'CHECKBOX', FALSE, 71, NOW()),

-- Beneficiary Marriage Information (Part 4)
(@i130_template_id, 'form1[0].#subform[5].Pt4Line19_DateOfMarriage[0]', 'beneficiaryCurrentMarriageDate', 'DATE', FALSE, 72, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line20a_CityTown[0]', 'beneficiaryMarriageCity', 'TEXT', FALSE, 73, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line20b_State[0]', 'beneficiaryMarriageState', 'TEXT', FALSE, 74, NOW()),
(@i130_template_id, 'form1[0].#subform[5].Pt4Line20d_Country[0]', 'beneficiaryMarriageCountry', 'TEXT', FALSE, 75, NOW()),

-- Beneficiary Immigration Status (Part 4)
(@i130_template_id, 'form1[0].#subform[6].Pt4Line20_Yes[0]', 'beneficiaryInUSYes', 'CHECKBOX', FALSE, 76, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line20_No[0]', 'beneficiaryInUSNo', 'CHECKBOX', FALSE, 77, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line21a_ClassOfAdmission[0]', 'beneficiaryClassOfAdmission', 'TEXT', FALSE, 78, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line21c_DateOfArrival[0]', 'beneficiaryDateOfArrival', 'DATE', FALSE, 79, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line22_PassportNumber[0]', 'beneficiaryPassportNumber', 'TEXT', FALSE, 80, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line24_CountryOfIssuance[0]', 'beneficiaryPassportCountry', 'TEXT', FALSE, 81, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line25_ExpDate[0]', 'beneficiaryPassportExpDate', 'DATE', FALSE, 82, NOW()),

-- Beneficiary Employment Information (Part 4)
(@i130_template_id, 'form1[0].#subform[6].Pt4Line26_NameOfCompany[0]', 'beneficiaryEmployerName', 'TEXT', FALSE, 83, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line26_StreetNumberName[0]', 'beneficiaryEmployerAddress', 'TEXT', FALSE, 84, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line26_CityOrTown[0]', 'beneficiaryEmployerCity', 'TEXT', FALSE, 85, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line26_State[0]', 'beneficiaryEmployerState', 'TEXT', FALSE, 86, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line26_ZipCode[0]', 'beneficiaryEmployerZipCode', 'TEXT', FALSE, 87, NOW()),
(@i130_template_id, 'form1[0].#subform[6].Pt4Line27_DateEmploymentBegan[0]', 'beneficiaryEmploymentStartDate', 'DATE', FALSE, 88, NOW());