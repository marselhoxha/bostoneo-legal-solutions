-- Create LegalDocument table if it doesn't exist
CREATE TABLE IF NOT EXISTS LegalDocument (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) DEFAULT 'OTHER',
    status VARCHAR(50) NOT NULL,
    caseId BIGINT,
    description VARCHAR(1000),
    url VARCHAR(512) NOT NULL,
    uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fileName VARCHAR(255) NOT NULL,
    fileType VARCHAR(100),
    fileSize BIGINT,
    uploadedBy BIGINT,
    FOREIGN KEY (caseId) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (uploadedBy) REFERENCES Users(id)
);

-- Create table for document tags
CREATE TABLE IF NOT EXISTS LegalDocument_tags (
    LegalDocument_id BIGINT NOT NULL,
    tags VARCHAR(255),
    PRIMARY KEY (LegalDocument_id, tags),
    FOREIGN KEY (LegalDocument_id) REFERENCES LegalDocument(id) ON DELETE CASCADE
);

-- Create DocumentVersion table
CREATE TABLE IF NOT EXISTS DocumentVersion (
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
    FOREIGN KEY (documentId) REFERENCES LegalDocument(id) ON DELETE CASCADE,
    FOREIGN KEY (uploadedBy) REFERENCES Users(id),
    UNIQUE KEY document_version_unique (documentId, versionNumber)
); 
CREATE TABLE IF NOT EXISTS LegalDocument (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) DEFAULT 'OTHER',
    status VARCHAR(50) NOT NULL,
    caseId BIGINT,
    description VARCHAR(1000),
    url VARCHAR(512) NOT NULL,
    uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fileName VARCHAR(255) NOT NULL,
    fileType VARCHAR(100),
    fileSize BIGINT,
    uploadedBy BIGINT,
    FOREIGN KEY (caseId) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (uploadedBy) REFERENCES Users(id)
);

-- Create table for document tags
CREATE TABLE IF NOT EXISTS LegalDocument_tags (
    LegalDocument_id BIGINT NOT NULL,
    tags VARCHAR(255),
    PRIMARY KEY (LegalDocument_id, tags),
    FOREIGN KEY (LegalDocument_id) REFERENCES LegalDocument(id) ON DELETE CASCADE
);

-- Create DocumentVersion table
CREATE TABLE IF NOT EXISTS DocumentVersion (
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
    FOREIGN KEY (documentId) REFERENCES LegalDocument(id) ON DELETE CASCADE,
    FOREIGN KEY (uploadedBy) REFERENCES Users(id),
    UNIQUE KEY document_version_unique (documentId, versionNumber)
); 
 
 