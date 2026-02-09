package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.configuration.FileStorageConfiguration;
import com.bostoneo.bostoneosolutions.service.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "file.storage.type", havingValue = "s3")
@Slf4j
public class S3FileStorageServiceImpl implements FileStorageService {

    private final FileStorageConfiguration config;
    private final S3Client s3Client;

    public S3FileStorageServiceImpl(FileStorageConfiguration config) {
        this.config = config;
        this.s3Client = S3Client.builder()
                .region(Region.of(config.getS3Region()))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    @PostConstruct
    public void init() {
        log.info("S3 file storage initialized - bucket: {}, region: {}", config.getS3BucketName(), config.getS3Region());
    }

    @Override
    public String storeFile(MultipartFile file, String subdirectory) throws IOException {
        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename());
        String uniqueFileName = generateUniqueFileName(originalFileName);
        return storeFile(file, subdirectory, uniqueFileName);
    }

    @Override
    public String storeFile(MultipartFile file, String subdirectory, String fileName) throws IOException {
        log.info("S3 storeFile: subdirectory='{}', fileName='{}', size={}", subdirectory, fileName, file.getSize());

        if (!StringUtils.hasText(fileName) || fileName.contains("..")) {
            throw new IOException("Invalid filename: " + fileName);
        }

        if (!isValidFileExtension(fileName)) {
            throw new IOException("File type not allowed: " + getFileExtension(fileName));
        }

        if (file.getSize() > config.getMaxFileSize()) {
            throw new IOException("File size exceeds maximum allowed: " + config.getMaxFileSize());
        }

        String s3Key = subdirectory + "/" + fileName;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(config.getS3BucketName())
                    .key(s3Key)
                    .contentType(file.getContentType())
                    .contentLength(file.getSize())
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            log.info("File stored in S3: s3://{}/{}", config.getS3BucketName(), s3Key);

            return s3Key;
        } catch (S3Exception e) {
            log.error("S3 upload failed for key {}: {}", s3Key, e.getMessage(), e);
            throw new IOException("Could not store file in S3: " + fileName, e);
        }
    }

    @Override
    public Resource loadFileAsResource(String filePath) throws IOException {
        log.debug("S3 loadFileAsResource: {}", filePath);

        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(config.getS3BucketName())
                    .key(filePath)
                    .build();

            byte[] content = s3Client.getObjectAsBytes(getRequest).asByteArray();
            log.info("Loaded {} bytes from S3 key: {}", content.length, filePath);

            return new ByteArrayResource(content) {
                @Override
                public String getFilename() {
                    return filePath.contains("/") ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;
                }
            };
        } catch (NoSuchKeyException e) {
            log.error("S3 file not found: {}", filePath);
            throw new IOException("File not found in S3: " + filePath, e);
        } catch (S3Exception e) {
            log.error("S3 load failed for key {}: {}", filePath, e.getMessage(), e);
            throw new IOException("Could not load file from S3: " + filePath, e);
        }
    }

    @Override
    public boolean deleteFile(String filePath) {
        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(config.getS3BucketName())
                    .key(filePath)
                    .build();

            s3Client.deleteObject(deleteRequest);
            log.info("Deleted S3 object: {}", filePath);
            return true;
        } catch (S3Exception e) {
            log.error("S3 delete failed for key {}: {}", filePath, e.getMessage());
            return false;
        }
    }

    @Override
    public String generateUniqueFileName(String originalFileName) {
        String extension = getFileExtension(originalFileName);
        String baseName = getBaseName(originalFileName);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String uuid = UUID.randomUUID().toString().substring(0, 8);
        return String.format("%s_%s_%s.%s", baseName, timestamp, uuid, extension);
    }

    @Override
    public String getFileExtension(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "";
        }
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : "";
    }

    @Override
    public boolean isValidFileExtension(String fileName) {
        String extension = getFileExtension(fileName);
        return config.isExtensionAllowed(extension);
    }

    @Override
    public long getFileSize(String filePath) throws IOException {
        try {
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(config.getS3BucketName())
                    .key(filePath)
                    .build();

            HeadObjectResponse response = s3Client.headObject(headRequest);
            return response.contentLength();
        } catch (S3Exception e) {
            throw new IOException("Could not get file size from S3: " + filePath, e);
        }
    }

    @Override
    public void createDirectoryIfNotExists(Path directory) throws IOException {
        // No-op for S3 — directories are implicit in key prefixes
    }

    @Override
    public String generateThumbnail(String originalFilePath, String fileName) throws IOException {
        // Thumbnails not supported in S3 mode
        return null;
    }

    @Override
    public void cleanupTempFiles() {
        // No-op for S3
    }

    @Override
    public void cleanupDeletedFiles() {
        // No-op for S3 — S3 lifecycle rules handle this
        log.info("S3 cleanupDeletedFiles: handled by S3 lifecycle rules");
    }

    private String getBaseName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "file";
        }
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }
}
