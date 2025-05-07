-- Create DocumentVersion table
CREATE TABLE IF NOT EXISTS documentversion (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    documentId BIGINT NOT NULL,
    versionNumber INT NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    fileUrl VARCHAR(512) NOT NULL,
    changes VARCHAR(512),
    uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uploadedBy BIGINT,
    fileType VARCHAR(100),
    fileSize BIGINT,
    FOREIGN KEY (documentId) REFERENCES legaldocument(id) ON DELETE CASCADE,
    UNIQUE KEY document_version_unique (documentId, versionNumber)
); 
CREATE TABLE IF NOT EXISTS documentversion (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    documentId BIGINT NOT NULL,
    versionNumber INT NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    fileUrl VARCHAR(512) NOT NULL,
    changes VARCHAR(512),
    uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uploadedBy BIGINT,
    fileType VARCHAR(100),
    fileSize BIGINT,
    FOREIGN KEY (documentId) REFERENCES legaldocument(id) ON DELETE CASCADE,
    UNIQUE KEY document_version_unique (documentId, versionNumber)
); 
 
 