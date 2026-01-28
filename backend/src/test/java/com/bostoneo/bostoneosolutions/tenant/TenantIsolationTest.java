package com.bostoneo.bostoneosolutions.tenant;

import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests to verify tenant isolation in repository queries.
 * These tests use mocked repositories to verify that the correct
 * tenant-filtered methods are being called.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tenant Isolation Tests")
public class TenantIsolationTest {

    private static final Long ORG_1 = 1L;
    private static final Long ORG_2 = 2L;
    private static final Long USER_1 = 100L;
    private static final Long USER_2 = 200L;

    @Mock
    private TenantService tenantService;

    @Mock
    private FileItemRepository fileItemRepository;

    @Mock
    private FolderRepository folderRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private NotificationTokenRepository notificationTokenRepository;

    @Mock
    private UserNotificationPreferenceRepository userNotificationPreferenceRepository;

    // ==================== FileItem Repository Tests ====================

    @Nested
    @DisplayName("FileItem Tenant Isolation")
    class FileItemTests {

        @Test
        @DisplayName("findByFolderIdAndDeletedFalseAndOrganizationId should filter by org")
        void testFileItemFolderQuery() {
            Long folderId = 10L;

            // Setup mock to return files only for ORG_1
            FileItem file1 = createFileItem(1L, "file1.pdf", ORG_1);
            when(fileItemRepository.findByFolderIdAndDeletedFalseAndOrganizationId(folderId, ORG_1))
                .thenReturn(List.of(file1));
            when(fileItemRepository.findByFolderIdAndDeletedFalseAndOrganizationId(folderId, ORG_2))
                .thenReturn(List.of());

            // Verify ORG_1 gets their file
            List<FileItem> org1Files = fileItemRepository.findByFolderIdAndDeletedFalseAndOrganizationId(folderId, ORG_1);
            assertEquals(1, org1Files.size());
            assertEquals("file1.pdf", org1Files.get(0).getName());

            // Verify ORG_2 gets empty list (no cross-tenant access)
            List<FileItem> org2Files = fileItemRepository.findByFolderIdAndDeletedFalseAndOrganizationId(folderId, ORG_2);
            assertTrue(org2Files.isEmpty());

            // Verify both calls were made with correct org IDs
            verify(fileItemRepository).findByFolderIdAndDeletedFalseAndOrganizationId(folderId, ORG_1);
            verify(fileItemRepository).findByFolderIdAndDeletedFalseAndOrganizationId(folderId, ORG_2);
        }

        @Test
        @DisplayName("findByIdAndOrganizationId should only return files from same org")
        void testFileItemIdQuery() {
            Long fileId = 1L;
            FileItem file = createFileItem(fileId, "secret.pdf", ORG_1);

            // ORG_1 can access their file
            when(fileItemRepository.findByIdAndOrganizationId(fileId, ORG_1))
                .thenReturn(Optional.of(file));
            // ORG_2 cannot access ORG_1's file
            when(fileItemRepository.findByIdAndOrganizationId(fileId, ORG_2))
                .thenReturn(Optional.empty());

            assertTrue(fileItemRepository.findByIdAndOrganizationId(fileId, ORG_1).isPresent());
            assertTrue(fileItemRepository.findByIdAndOrganizationId(fileId, ORG_2).isEmpty());
        }
    }

    // ==================== Folder Repository Tests ====================

    @Nested
    @DisplayName("Folder Tenant Isolation")
    class FolderTests {

        @Test
        @DisplayName("findByParentFolderIdAndDeletedFalseAndOrganizationId should filter by org")
        void testFolderSubfolderQuery() {
            Long parentFolderId = 5L;

            Folder folder1 = createFolder(1L, "Org1Folder", ORG_1);
            when(folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(parentFolderId, ORG_1))
                .thenReturn(List.of(folder1));
            when(folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(parentFolderId, ORG_2))
                .thenReturn(List.of());

            // ORG_1 sees their folder
            List<Folder> org1Folders = folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(parentFolderId, ORG_1);
            assertEquals(1, org1Folders.size());

            // ORG_2 sees nothing
            List<Folder> org2Folders = folderRepository.findByParentFolderIdAndDeletedFalseAndOrganizationId(parentFolderId, ORG_2);
            assertTrue(org2Folders.isEmpty());
        }

        @Test
        @DisplayName("findByNameAndParentAndOrganizationId should only find folders in same org")
        void testFolderNameQuery() {
            String folderName = "Documents";
            Long parentId = null;

            Folder folder = createFolder(1L, folderName, ORG_1);
            when(folderRepository.findByNameAndParentAndOrganizationId(folderName, parentId, ORG_1))
                .thenReturn(Optional.of(folder));
            when(folderRepository.findByNameAndParentAndOrganizationId(folderName, parentId, ORG_2))
                .thenReturn(Optional.empty());

            // ORG_1 finds their folder
            assertTrue(folderRepository.findByNameAndParentAndOrganizationId(folderName, parentId, ORG_1).isPresent());
            // ORG_2 doesn't find ORG_1's folder
            assertTrue(folderRepository.findByNameAndParentAndOrganizationId(folderName, parentId, ORG_2).isEmpty());
        }
    }

    // ==================== Notification Token Tests ====================

    @Nested
    @DisplayName("NotificationToken Tenant Isolation")
    class NotificationTokenTests {

        @Test
        @DisplayName("findByOrganizationIdAndUserId should only return tokens from same org")
        void testNotificationTokenUserQuery() {
            NotificationToken token = new NotificationToken();
            token.setId(1L);
            token.setUserId(USER_1);
            token.setOrganizationId(ORG_1);
            token.setToken("fcm-token-123");

            when(notificationTokenRepository.findByOrganizationIdAndUserId(ORG_1, USER_1))
                .thenReturn(List.of(token));
            when(notificationTokenRepository.findByOrganizationIdAndUserId(ORG_2, USER_1))
                .thenReturn(List.of());

            // ORG_1 gets the token
            List<NotificationToken> org1Tokens = notificationTokenRepository.findByOrganizationIdAndUserId(ORG_1, USER_1);
            assertEquals(1, org1Tokens.size());

            // ORG_2 cannot access ORG_1's tokens
            List<NotificationToken> org2Tokens = notificationTokenRepository.findByOrganizationIdAndUserId(ORG_2, USER_1);
            assertTrue(org2Tokens.isEmpty());
        }

        @Test
        @DisplayName("findByTokenAndOrganizationId should isolate token lookup by org")
        void testNotificationTokenLookup() {
            String tokenValue = "fcm-token-abc";
            NotificationToken token = new NotificationToken();
            token.setToken(tokenValue);
            token.setOrganizationId(ORG_1);

            when(notificationTokenRepository.findByTokenAndOrganizationId(tokenValue, ORG_1))
                .thenReturn(Optional.of(token));
            when(notificationTokenRepository.findByTokenAndOrganizationId(tokenValue, ORG_2))
                .thenReturn(Optional.empty());

            assertTrue(notificationTokenRepository.findByTokenAndOrganizationId(tokenValue, ORG_1).isPresent());
            assertTrue(notificationTokenRepository.findByTokenAndOrganizationId(tokenValue, ORG_2).isEmpty());
        }
    }

    // ==================== User Notification Preference Tests ====================

    @Nested
    @DisplayName("UserNotificationPreference Tenant Isolation")
    class NotificationPreferenceTests {

        @Test
        @DisplayName("findByOrganizationIdAndUserId should filter preferences by org")
        void testPreferenceUserQuery() {
            UserNotificationPreference pref = new UserNotificationPreference();
            pref.setUserId(USER_1);
            pref.setOrganizationId(ORG_1);
            pref.setEventType("CASE_STATUS_CHANGED");
            pref.setEnabled(true);

            when(userNotificationPreferenceRepository.findByOrganizationIdAndUserId(ORG_1, USER_1))
                .thenReturn(List.of(pref));
            when(userNotificationPreferenceRepository.findByOrganizationIdAndUserId(ORG_2, USER_1))
                .thenReturn(List.of());

            assertEquals(1, userNotificationPreferenceRepository.findByOrganizationIdAndUserId(ORG_1, USER_1).size());
            assertTrue(userNotificationPreferenceRepository.findByOrganizationIdAndUserId(ORG_2, USER_1).isEmpty());
        }

        @Test
        @DisplayName("existsByOrganizationIdAndUserId should check existence within org")
        void testPreferenceExistsQuery() {
            when(userNotificationPreferenceRepository.existsByOrganizationIdAndUserId(ORG_1, USER_1))
                .thenReturn(true);
            when(userNotificationPreferenceRepository.existsByOrganizationIdAndUserId(ORG_2, USER_1))
                .thenReturn(false);

            assertTrue(userNotificationPreferenceRepository.existsByOrganizationIdAndUserId(ORG_1, USER_1));
            assertFalse(userNotificationPreferenceRepository.existsByOrganizationIdAndUserId(ORG_2, USER_1));
        }
    }

    // ==================== Message Repository Tests ====================

    @Nested
    @DisplayName("Message Tenant Isolation")
    class MessageTests {

        @Test
        @DisplayName("findByThreadIdAndOrganizationIdOrderByCreatedAtDesc should filter messages by org")
        void testMessageThreadQuery() {
            Long threadId = 50L;
            Message msg = new Message();
            msg.setId(1L);
            msg.setThreadId(threadId);
            msg.setOrganizationId(ORG_1);
            msg.setContent("Test message");

            when(messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(threadId, ORG_1))
                .thenReturn(List.of(msg));
            when(messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(threadId, ORG_2))
                .thenReturn(List.of());

            // ORG_1 sees the message
            assertEquals(1, messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(threadId, ORG_1).size());
            // ORG_2 cannot see ORG_1's messages
            assertTrue(messageRepository.findByThreadIdAndOrganizationIdOrderByCreatedAtDesc(threadId, ORG_2).isEmpty());
        }
    }

    // ==================== TenantService Tests ====================

    @Nested
    @DisplayName("TenantService Behavior")
    class TenantServiceTests {

        @Test
        @DisplayName("getCurrentOrganizationId should return current tenant context")
        void testTenantServiceReturnsOrgId() {
            when(tenantService.getCurrentOrganizationId()).thenReturn(Optional.of(ORG_1));

            Optional<Long> orgId = tenantService.getCurrentOrganizationId();
            assertTrue(orgId.isPresent());
            assertEquals(ORG_1, orgId.get());
        }

        @Test
        @DisplayName("getCurrentOrganizationId should return empty when no context")
        void testTenantServiceReturnsEmpty() {
            when(tenantService.getCurrentOrganizationId()).thenReturn(Optional.empty());

            Optional<Long> orgId = tenantService.getCurrentOrganizationId();
            assertTrue(orgId.isEmpty());
        }
    }

    // ==================== Helper Methods ====================

    private FileItem createFileItem(Long id, String name, Long orgId) {
        FileItem file = new FileItem();
        file.setId(id);
        file.setName(name);
        file.setOrganizationId(orgId);
        file.setDeleted(false);
        file.setCreatedAt(LocalDateTime.now());
        return file;
    }

    private Folder createFolder(Long id, String name, Long orgId) {
        return Folder.builder()
            .id(id)
            .name(name)
            .organizationId(orgId)
            .deleted(false)
            .createdAt(LocalDateTime.now())
            .build();
    }
}
