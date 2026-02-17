-- Add BoldSign brand customization fields to organizations table
ALTER TABLE organizations
    ADD COLUMN boldsign_brand_name VARCHAR(200) NULL,
    ADD COLUMN boldsign_brand_logo_url VARCHAR(500) NULL,
    ADD COLUMN boldsign_primary_color VARCHAR(20) NULL,
    ADD COLUMN boldsign_background_color VARCHAR(20) NULL,
    ADD COLUMN boldsign_button_color VARCHAR(20) NULL,
    ADD COLUMN boldsign_button_text_color VARCHAR(20) NULL;
