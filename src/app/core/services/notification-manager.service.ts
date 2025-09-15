import { Injectable } from '@angular/core';
import { PushNotificationService } from './push-notification.service';
import { UserService } from '../../service/user.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../../interface/user';
import { Key } from '../../enum/key.enum';

export interface NotificationContext {
  triggeredBy: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
  timestamp: string;
  entityId?: number;
  entityType?: string;
  previousState?: any;
  newState?: any;
  additionalData?: any;
}

export interface NotificationRecipients {
  primaryUsers: User[];
  secondaryUsers?: User[];
  excludeUsers?: number[];
}

export enum NotificationPriority {
  CRITICAL = 'critical',
  HIGH = 'high', 
  NORMAL = 'normal',
  LOW = 'low'
}

export enum NotificationCategory {
  CASE_MANAGEMENT = 'case_management',
  CRM = 'crm',
  TIME_TRACKING = 'time_tracking',
  BILLING = 'billing',
  CALENDAR = 'calendar',
  FILES = 'files',
  SYSTEM = 'system',
  ADMIN = 'admin'
}

@Injectable({
  providedIn: 'root'
})
export class NotificationManagerService {
  private readonly server: string = 'http://localhost:8085';
  private currentUser: User | null = null;

  constructor(
    private pushNotificationService: PushNotificationService,
    private userService: UserService,
    private http: HttpClient
  ) {
    // Subscribe to user data changes and check for missed notifications on login
    this.userService.userData$.subscribe(user => {
      const previousUser = this.currentUser;
      this.currentUser = user;
      
      // If user just logged in (previously null, now has user), check for missed notifications
      if (!previousUser && user?.id) {
        // Use setTimeout to avoid blocking the login flow
        setTimeout(() => {
          this.checkMissedNotifications(user.id);
        }, 2000); // Wait 2 seconds after login to check notifications
      }
    });
  }

  /**
   * Send notification with full context and smart recipient routing
   */
  async sendNotification(
    category: NotificationCategory,
    title: string,
    message: string,
    priority: NotificationPriority,
    recipients: NotificationRecipients,
    url?: string,
    context?: Partial<NotificationContext>
  ): Promise<void> {
    // Try to get current user if not set
    if (!this.currentUser) {
      this.currentUser = this.userService.getCurrentUser();
    }
    
    if (!this.currentUser) {
      console.warn('❌ Cannot send notification - no current user available');
      return;
    }

    // Build notification context
    const notificationContext: NotificationContext = {
      triggeredBy: {
        id: this.currentUser.id,
        name: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
        email: this.currentUser.email,
        avatar: this.currentUser.imageUrl
      },
      timestamp: new Date().toISOString(),
      ...context
    };

    // Build payload for push notification
    const payload = {
      notification: {
        title,
        body: message,
        icon: this.getNotificationIcon(category),
        badge: this.getBadgeCount(category)
      },
      data: {
        type: category,
        priority,
        triggeredBy: notificationContext.triggeredBy,
        timestamp: notificationContext.timestamp,
        url: url || this.getDefaultUrl(category),
        contextData: {
          entityId: context?.entityId,
          entityType: context?.entityType,
          previousState: context?.previousState,
          newState: context?.newState,
          additionalData: context?.additionalData
        },
        relatedUsers: this.getAllRecipientIds(recipients),
        actionRequired: priority === NotificationPriority.CRITICAL || priority === NotificationPriority.HIGH
      }
    };

    // Send push notification to all recipients
    const allRecipients = [
      ...recipients.primaryUsers,
      ...(recipients.secondaryUsers || [])
    ].filter(user => !recipients.excludeUsers?.includes(user.id));

    // Deduplicate recipients by user ID to prevent multiple notifications to same user
    const uniqueRecipients = allRecipients.filter((user, index, arr) => 
      arr.findIndex(u => u.id === user.id) === index
    );

    // 🔍 NOTIFICATION DELIVERY AUDIT LOG
    console.log(`🔍 📧 NOTIFICATION DELIVERY AUDIT - ${title}`);
    console.log(`🔍 📧   Category: ${category}`);
    console.log(`🔍 📧   Priority: ${priority}`);
    console.log(`🔍 📧   Message: ${message}`);
    console.log(`🔍 📧   Triggered by: ${notificationContext.triggeredBy.name} (${notificationContext.triggeredBy.email})`);
    console.log(`🔍 📧   Primary recipients: ${recipients.primaryUsers.length}`);
    recipients.primaryUsers.forEach(user => {
      console.log(`🔍 📧     - ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
    });
    if (recipients.secondaryUsers?.length) {
      console.log(`🔍 📧   Secondary recipients: ${recipients.secondaryUsers.length}`);
      recipients.secondaryUsers.forEach(user => {
        console.log(`🔍 📧     - ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
      });
    }
    if (recipients.excludeUsers?.length) {
      console.log(`🔍 📧   Excluded users: ${recipients.excludeUsers.join(', ')}`);
    }
    console.log(`🔍 📧   Final unique recipients: ${uniqueRecipients.length}`);
    uniqueRecipients.forEach(user => {
      console.log(`🔍 📧     ✅ WILL RECEIVE: ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
    });
    
    // Send only one notification (not per recipient) since it's a broadcast notification
    if (uniqueRecipients.length > 0) {
      try {
        console.log(`🔍 📧   📤 SENDING push notification to ${uniqueRecipients.length} recipients`);
        this.pushNotificationService.sendCustomNotification(payload);
        console.log(`🔍 📧   ✅ Push notification sent successfully`);
      } catch (error) {
        console.error('🔍 📧   ❌ Failed to send push notification:', error);
      }
    } else {
      console.log(`🔍 📧   ⚠️ NO RECIPIENTS - Notification not sent`);
    }

    // Also send via backend for offline notifications
    try {
      const recipientIds = uniqueRecipients.map(u => u.id);
      console.log(`🔍 📧   📤 SENDING backend notification to user IDs: ${recipientIds.join(', ')}`);
      
      await this.sendBackendNotification(
        title,
        message,
        category,
        priority,
        recipientIds,
        notificationContext
      );
      
      console.log(`🔍 📧   ✅ Backend notification sent successfully to ${recipientIds.length} users`);
    } catch (error) {
      console.error('🔍 📧   ❌ Failed to send backend notification:', error);
      // Don't fail the whole notification if backend fails
    }
    
    console.log(`🔍 📧 END NOTIFICATION DELIVERY AUDIT - ${title}`);
    console.log('🔍 📧 ==========================================');
  }

  /**
   * Send notification via backend for offline delivery and persistence
   */
  private async sendBackendNotification(
    title: string,
    message: string,
    category: NotificationCategory,
    priority: NotificationPriority,
    userIds: number[],
    context: NotificationContext
  ): Promise<void> {
    const headers = this.getAuthHeaders();
    
    // Send individual notifications for each user since backend expects single userId
    for (const userId of userIds) {
      const payload = {
        userId,
        title,
        message,
        type: this.mapCategoryToBackendType(category, context),
        priority: priority.toUpperCase(),
        triggeredBy: context.triggeredBy?.id,
        triggeredByName: context.triggeredBy?.name,
        entityId: context.entityId,
        entityType: context.entityType,
        url: context.additionalData?.context?.url || null,
        additionalData: JSON.stringify({
          ...context.additionalData,
          triggeredBy: context.triggeredBy,
          timestamp: context.timestamp
        })
      };

      try {
        console.log(`🔍 📧     📤 Sending backend notification to user ${userId}`);
        await this.http.post(`${this.server}/api/v1/notifications/send`, payload, { headers }).toPromise();
        console.log(`🔍 📧     ✅ Backend notification sent to user ${userId}`);
      } catch (error) {
        console.error(`🔍 📧     ❌ Failed to send backend notification to user ${userId}:`, error);
        // Continue sending to other users even if one fails
      }
    }
  }

  /**
   * Map frontend notification category to backend notification type
   */
  private mapCategoryToBackendType(category: NotificationCategory, context: NotificationContext): string {
    // Check for specific event types based on context
    if (category === NotificationCategory.CRM) {
      // Check if this is a lead status change based on the title pattern
      if (context.additionalData?.template?.category === 'lead_status' || 
          (context.additionalData?.context?.additionalInfo?.oldStatus && 
           context.additionalData?.context?.additionalInfo?.newStatus)) {
        return 'LEAD_STATUS_CHANGED';
      }
      return 'CRM';
    }
    
    // For other categories, use the default mapping
    return category.toUpperCase();
  }

  /**
   * Get authentication headers for backend requests
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Check for missed notifications when user logs back in
   */
  async checkMissedNotifications(userId: number): Promise<void> {
    try {
      const headers = this.getAuthHeaders();
      const response = await this.http.get<any>(
        `${this.server}/api/v1/notifications/user/${userId}?page=0&size=10`, 
        { headers }
      ).toPromise();
      
      // If there are notifications from backend, show them individually
      if (response?.data?.notifications && response.data.notifications.length > 0) {
        const allNotifications = response.data.notifications;
        
        // Send each individual notification to display
        allNotifications.forEach((backendNotif: any) => {
          const individualPayload = {
            notification: {
              title: backendNotif.title || 'Notification',
              body: backendNotif.message || 'You have a new notification',
              icon: '/assets/images/logo-sm.png'
            },
            data: {
              type: backendNotif.type?.toLowerCase() || 'default',
              priority: backendNotif.priority?.toLowerCase() || 'normal',
              url: backendNotif.url || '/dashboard',
              backendId: backendNotif.id,
              isFromBackend: true,
              createdAt: backendNotif.createdAt,
              read: backendNotif.read || false
            }
          };
          
          this.pushNotificationService.sendCustomNotification(individualPayload);
        });
      }
    } catch (error) {
      console.error('❌ Failed to check missed notifications:', error);
      // Don't throw error - this is not critical for app functionality
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const headers = this.getAuthHeaders();
      await this.http.put(
        `${this.server}/api/v1/notifications/${notificationId}/read`, 
        {}, 
        { headers }
      ).toPromise();
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
    }
  }

  /**
   * Get case team members for case-related notifications
   * Enhanced with comprehensive role matching and fallback to all eligible users
   */
  async getCaseTeamMembers(caseId: number): Promise<User[]> {
    try {
      console.log(`🔍 Getting case team members for case ${caseId}`);
      
      // Try multiple role variations for comprehensive coverage
      const attorneys = await this.getUsersByRole('ATTORNEY');
      const managers = await this.getUsersByRole('MANAGER');
      const paralegals = await this.getUsersByRole('PARALEGAL');
      const admins = await this.getUsersByRole('ADMIN');
      
      // Combine all legal professionals
      const caseTeam = [...attorneys, ...managers, ...paralegals, ...admins];
      
      // Remove duplicates based on user ID
      const uniqueTeam = caseTeam.filter((user, index, arr) => 
        arr.findIndex(u => u.id === user.id) === index
      );
      
      console.log(`🔍 Case team members found: ${uniqueTeam.length}`);
      uniqueTeam.forEach(user => {
        console.log(`🔍   - ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
      });
      
      // If no team members found, fallback to all eligible users
      if (uniqueTeam.length === 0) {
        console.log('🔍 No specific case team found, using all eligible users as fallback');
        return await this.getAllEligibleUsers();
      }
      
      return uniqueTeam;
    } catch (error) {
      console.error('Failed to get case team members:', error);
      // Return all eligible users as final fallback
      return await this.getAllEligibleUsers();
    }
  }

  /**
   * Get task watchers (assignee, creator, supervisors)
   * Enhanced with comprehensive role matching and fallback to all eligible users
   */
  async getTaskWatchers(taskId: number): Promise<User[]> {
    try {
      console.log(`🔍 Getting task watchers for task ${taskId}`);
      
      // Get comprehensive set of users who should watch tasks
      const attorneys = await this.getUsersByRole('ATTORNEY');
      const managers = await this.getUsersByRole('MANAGER');
      const paralegals = await this.getUsersByRole('PARALEGAL');
      
      // Combine relevant watchers
      const watchers = [...attorneys, ...managers, ...paralegals];
      
      // Remove duplicates based on user ID
      const uniqueWatchers = watchers.filter((user, index, arr) => 
        arr.findIndex(u => u.id === user.id) === index
      );
      
      console.log(`🔍 Task watchers found: ${uniqueWatchers.length}`);
      uniqueWatchers.forEach(user => {
        console.log(`🔍   - ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
      });
      
      // If no watchers found, fallback to all eligible users but limit to avoid spam
      if (uniqueWatchers.length === 0) {
        console.log('🔍 No specific task watchers found, using limited eligible users as fallback');
        const allEligible = await this.getAllEligibleUsers();
        return allEligible.slice(0, 10); // Limit to first 10 to avoid spam
      }
      
      return uniqueWatchers;
    } catch (error) {
      console.error('Failed to get task watchers:', error);
      // Return limited eligible users as final fallback
      const allEligible = await this.getAllEligibleUsers();
      return allEligible.slice(0, 10);
    }
  }

  /**
   * Get user's supervisors
   * Enhanced with comprehensive role matching for management roles
   */
  async getSupervisors(userId: number): Promise<User[]> {
    try {
      console.log(`🔍 Getting supervisors for user ${userId}`);
      
      // Get comprehensive set of management/supervisory roles
      const managers = await this.getUsersByRole('MANAGER');
      const admins = await this.getUsersByRole('ADMIN');
      const seniors = await this.getUsersByRole('SENIOR_ATTORNEY');
      const partners = await this.getUsersByRole('PARTNER');
      
      // Combine all supervisory roles
      const supervisors = [...managers, ...admins, ...seniors, ...partners];
      
      // Remove duplicates and the user themselves
      const uniqueSupervisors = supervisors.filter((user, index, arr) => 
        arr.findIndex(u => u.id === user.id) === index && user.id !== userId
      );
      
      console.log(`🔍 Supervisors found: ${uniqueSupervisors.length}`);
      uniqueSupervisors.forEach(user => {
        console.log(`🔍   - ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.roleName}`);
      });
      
      return uniqueSupervisors;
    } catch (error) {
      console.error('Failed to get supervisors:', error);
      return [];
    }
  }

  /**
   * Get users by department
   * TODO: Implement proper department endpoint
   */
  async getDepartmentMembers(department: string): Promise<User[]> {
    try {
      // For now, return relevant roles based on department name
      if (department.toLowerCase().includes('legal')) {
        return await this.getUsersByRole('ROLE_ATTORNEY');
      } else if (department.toLowerCase().includes('admin')) {
        return await this.getUsersByRole('ROLE_ADMIN');
      } else {
        // Return all users for other departments
        return await this.getUsersByRole('ROLE_USER');
      }
    } catch (error) {
      console.error('Failed to get department members:', error);
      return [];
    }
  }

  /**
   * Get ALL users from database (for testing purposes)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const response = await this.http.get<{data: {users: User[]}}>(`${this.server}/user/list`).toPromise();
      const allUsers = response?.data?.users || [];
      return allUsers;
    } catch (error) {
      console.error('Failed to get all users:', error);
      return [];
    }
  }

  /**
   * 🔍 DEBUGGING: Log all users and their role/permission data for notification targeting analysis
   */
  async logAllUsersForNotificationTargeting(): Promise<void> {
    console.log('🔍 =========================== USER NOTIFICATION TARGETING ANALYSIS ===========================');
    try {
      const allUsers = await this.getAllUsers();
      console.log(`🔍 Total users found: ${allUsers.length}`);
      
      allUsers.forEach((user, index) => {
        console.log(`🔍 --- User ${index + 1}/${allUsers.length} ---`);
        console.log(`🔍 ID: ${user.id}`);
        console.log(`🔍 Name: ${user.firstName} ${user.lastName}`);
        console.log(`🔍 Email: ${user.email}`);
        console.log(`🔍 Primary Role Name: ${user.roleName}`);
        console.log(`🔍 Primary Role Name (backup): ${user.primaryRoleName}`);
        console.log(`🔍 Roles Array: ${JSON.stringify(user.roles)}`);
        console.log(`🔍 Permissions String: ${user.permissions}`);
        console.log(`🔍 Enabled: ${user.enabled}`);
        console.log(`🔍 Not Locked: ${user.notLocked}`);
        
        // Check if this is Jennifer Rodriguez
        if (user.firstName?.toLowerCase().includes('jennifer') || user.lastName?.toLowerCase().includes('rodriguez')) {
          console.log('🎯 *** THIS IS JENNIFER RODRIGUEZ - SPECIAL ATTENTION ***');
          console.log('🎯 Full user object:', JSON.stringify(user, null, 2));
        }
        
        console.log('🔍 ----------------------------------------');
      });
      
      // Test role-based filtering
      console.log('🔍 =========================== ROLE-BASED FILTERING TESTS ===========================');
      const roleTestCases = ['ROLE_ATTORNEY', 'ATTORNEY', 'ROLE_MANAGER', 'MANAGER', 'ROLE_PARALEGAL', 'PARALEGAL', 'ROLE_ADMIN', 'ADMIN'];
      
      for (const role of roleTestCases) {
        const usersWithRole = await this.getUsersByRole(role);
        console.log(`🔍 Users with role '${role}': ${usersWithRole.length} users`);
        usersWithRole.forEach(user => {
          console.log(`🔍   - ${user.firstName} ${user.lastName} (${user.email})`);
        });
      }
      
    } catch (error) {
      console.error('🔍 Failed to log user targeting analysis:', error);
    }
    console.log('🔍 =========================== END USER ANALYSIS ===========================');
  }

  /**
   * 🔍 DEBUGGING: Test if a specific user would receive notifications for different event types
   */
  async testUserNotificationEligibility(userId: number, userName?: string): Promise<void> {
    console.log(`🔍 =========================== TESTING NOTIFICATION ELIGIBILITY FOR USER ${userId} (${userName || 'Unknown'}) ===========================`);
    
    try {
      const allUsers = await this.getAllUsers();
      const testUser = allUsers.find(u => u.id === userId);
      
      if (!testUser) {
        console.log(`🔍 ❌ User ${userId} not found in user list`);
        return;
      }
      
      console.log(`🔍 Testing user: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`);
      console.log(`🔍 Role: ${testUser.roleName}`);
      console.log(`🔍 Permissions: ${testUser.permissions}`);
      
      // Test different event types
      const eventTypes = [
        'DOCUMENT_UPLOADED',
        'TASK_CREATED', 
        'TASK_ASSIGNED',
        'CASE_STATUS_CHANGED',
        'CASE_PRIORITY_CHANGED',
        'INVOICE_CREATED',
        'LEAD_STATUS_CHANGED'
      ];
      
      for (const eventType of eventTypes) {
        console.log(`🔍 --- Testing ${eventType} ---`);
        
        // Test current role-based filtering
        const attorneyUsers = await this.getUsersByRole('ROLE_ATTORNEY');
        const managerUsers = await this.getUsersByRole('ROLE_MANAGER');
        const paralegalUsers = await this.getUsersByRole('ROLE_PARALEGAL');
        
        const isInAttorneys = attorneyUsers.some(u => u.id === userId);
        const isInManagers = managerUsers.some(u => u.id === userId);
        const isInParalegals = paralegalUsers.some(u => u.id === userId);
        
        console.log(`🔍   Would be included in ATTORNEY recipients: ${isInAttorneys}`);
        console.log(`🔍   Would be included in MANAGER recipients: ${isInManagers}`);
        console.log(`🔍   Would be included in PARALEGAL recipients: ${isInParalegals}`);
        
        // Check if would be in case team (current fallback)
        const caseTeamMembers = await this.getCaseTeamMembers(1); // Test with case ID 1
        const isInCaseTeam = caseTeamMembers.some(u => u.id === userId);
        console.log(`🔍   Would be included in CASE TEAM fallback: ${isInCaseTeam}`);
      }
      
    } catch (error) {
      console.error('🔍 Failed to test user notification eligibility:', error);
    }
    
    console.log(`🔍 =========================== END ELIGIBILITY TEST FOR USER ${userId} ===========================`);
  }

  /**
   * 🔍 DEBUGGING: Enhanced getUsersByRole with detailed logging
   */
  private async getUsersByRoleWithLogging(role: string, eventType?: string): Promise<User[]> {
    console.log(`🔍 📋 Getting users by role: '${role}' for event: ${eventType || 'Unknown'}`);
    
    try {
      const response = await this.http.get<{data: {users: User[]}}>(`${this.server}/user/list`).toPromise();
      const allUsers = response?.data?.users || [];
      
      console.log(`🔍 📋 Total users in database: ${allUsers.length}`);
      
      // Enhanced filtering with multiple role name formats
      const filteredUsers = allUsers.filter((user: User) => {
        const primaryRole = user.roleName?.toUpperCase() || '';
        const secondaryRole = user.primaryRoleName?.toUpperCase() || '';
        const rolesArray = user.roles?.map(r => String(r).toUpperCase()) || [];
        const searchRole = role.toUpperCase();
        
        // Multiple matching strategies
        const exactMatch = primaryRole === searchRole || secondaryRole === searchRole;
        const rolesArrayMatch = rolesArray.includes(searchRole);
        const partialMatch = primaryRole.includes(searchRole.replace('ROLE_', '')) || 
                           secondaryRole.includes(searchRole.replace('ROLE_', ''));
        const reversePartialMatch = searchRole.includes(primaryRole.replace('ROLE_', '')) ||
                                  searchRole.includes(secondaryRole.replace('ROLE_', ''));
        
        const isMatch = exactMatch || rolesArrayMatch || partialMatch || reversePartialMatch;
        
        if (isMatch) {
          console.log(`🔍 📋   ✅ MATCH: ${user.firstName} ${user.lastName} (${user.email})`);
          console.log(`🔍 📋      Primary role: ${primaryRole}`);
          console.log(`🔍 📋      Secondary role: ${secondaryRole}`);
          console.log(`🔍 📋      Roles array: ${JSON.stringify(rolesArray)}`);
          console.log(`🔍 📋      Match reason: ${exactMatch ? 'exact' : rolesArrayMatch ? 'roles-array' : partialMatch ? 'partial' : 'reverse-partial'}`);
        }
        
        return isMatch;
      });
      
      console.log(`🔍 📋 Users found with role '${role}': ${filteredUsers.length}`);
      
      return filteredUsers;
    } catch (error) {
      console.error(`🔍 📋 Failed to get users by role '${role}':`, error);
      return [];
    }
  }

  /**
   * 🔍 DEBUGGING: Test Jennifer Rodriguez notification delivery specifically
   */
  async testJenniferRodriguezNotifications(): Promise<void> {
    console.log('🎯 =========================== JENNIFER RODRIGUEZ NOTIFICATION TEST ===========================');
    
    try {
      // Find Jennifer Rodriguez in user list
      const allUsers = await this.getAllUsers();
      const jenniferUser = allUsers.find(user => 
        (user.firstName?.toLowerCase().includes('jennifer') && user.lastName?.toLowerCase().includes('rodriguez')) ||
        user.email?.toLowerCase().includes('jennifer') ||
        user.email?.toLowerCase().includes('rodriguez')
      );
      
      if (!jenniferUser) {
        console.log('🎯 ❌ Jennifer Rodriguez not found in user database');
        console.log('🎯 Available users:');
        allUsers.forEach(user => {
          console.log(`🎯   - ${user.firstName} ${user.lastName} (${user.email})`);
        });
        return;
      }
      
      console.log(`🎯 ✅ FOUND Jennifer Rodriguez:`);
      console.log(`🎯   ID: ${jenniferUser.id}`);
      console.log(`🎯   Name: ${jenniferUser.firstName} ${jenniferUser.lastName}`);
      console.log(`🎯   Email: ${jenniferUser.email}`);
      console.log(`🎯   Role: ${jenniferUser.roleName}`);
      console.log(`🎯   Primary Role: ${jenniferUser.primaryRoleName}`);
      console.log(`🎯   Roles Array: ${JSON.stringify(jenniferUser.roles)}`);
      console.log(`🎯   Permissions: ${jenniferUser.permissions}`);
      console.log(`🎯   Enabled: ${jenniferUser.enabled}`);
      console.log(`🎯   Not Locked: ${jenniferUser.notLocked}`);
      
      // Test if Jennifer would be included in various role-based queries
      const rolesToTest = ['ATTORNEY', 'ROLE_ATTORNEY', 'MANAGER', 'ROLE_MANAGER', 'PARALEGAL', 'ROLE_PARALEGAL', 'ADMIN', 'ROLE_ADMIN', 'USER', 'ROLE_USER'];
      
      console.log(`🎯 Testing Jennifer's inclusion in role-based targeting:`);
      for (const role of rolesToTest) {
        const usersWithRole = await this.getUsersByRole(role);
        const isIncluded = usersWithRole.some(u => u.id === jenniferUser.id);
        console.log(`🎯   Role '${role}': ${isIncluded ? '✅ INCLUDED' : '❌ NOT INCLUDED'} (${usersWithRole.length} total users)`);
      }
      
      // Test case team membership
      console.log(`🎯 Testing case team membership:`);
      const caseTeamMembers = await this.getCaseTeamMembers(1); // Test with case ID 1
      const isInCaseTeam = caseTeamMembers.some(u => u.id === jenniferUser.id);
      console.log(`🎯   Case Team: ${isInCaseTeam ? '✅ INCLUDED' : '❌ NOT INCLUDED'} (${caseTeamMembers.length} total members)`);
      
      // Test all eligible users
      console.log(`🎯 Testing all eligible users inclusion:`);
      const allEligible = await this.getAllEligibleUsers();
      const isEligible = allEligible.some(u => u.id === jenniferUser.id);
      console.log(`🎯   All Eligible: ${isEligible ? '✅ INCLUDED' : '❌ NOT INCLUDED'} (${allEligible.length} total eligible)`);
      
      // Test a sample notification to Jennifer specifically
      console.log(`🎯 Testing sample notification delivery to Jennifer:`);
      try {
        await this.sendNotification(
          NotificationCategory.CASE_MANAGEMENT,
          '🧪 TEST: Jennifer Rodriguez Notification Test',
          'This is a test notification to verify Jennifer Rodriguez can receive notifications correctly.',
          NotificationPriority.HIGH,
          {
            primaryUsers: [jenniferUser],
            secondaryUsers: []
          },
          '/dashboard',
          {
            entityId: 999,
            entityType: 'test',
            additionalData: {
              testType: 'jennifer_rodriguez_notification_test',
              timestamp: new Date().toISOString()
            }
          }
        );
        console.log(`🎯 ✅ Test notification sent successfully to Jennifer Rodriguez`);
      } catch (error) {
        console.error(`🎯 ❌ Failed to send test notification to Jennifer:`, error);
      }
      
    } catch (error) {
      console.error('🎯 Failed to test Jennifer Rodriguez notifications:', error);
    }
    
    console.log('🎯 =========================== END JENNIFER TEST ===========================');
  }

  /**
   * 🔍 DEBUGGING: Initialize comprehensive debugging - run all diagnostic tests
   */
  async initializeNotificationDebugging(): Promise<void> {
    console.log('🔍 🔧 =========================== INITIALIZING NOTIFICATION DEBUGGING ===========================');
    
    try {
      // Step 1: Log all users and their roles
      console.log('🔍 🔧 Step 1: Logging all users for notification targeting analysis...');
      await this.logAllUsersForNotificationTargeting();
      
      // Step 2: Test Jennifer Rodriguez specifically
      console.log('🔍 🔧 Step 2: Testing Jennifer Rodriguez notification delivery...');
      await this.testJenniferRodriguezNotifications();
      
      console.log('🔍 🔧 DEBUGGING INITIALIZATION COMPLETE');
      console.log('🔍 🔧 =========================== END DEBUGGING INITIALIZATION ===========================');
      
    } catch (error) {
      console.error('🔍 🔧 Failed to initialize notification debugging:', error);
    }
  }

  /**
   * Get users by role - Enhanced with flexible role matching and debugging
   */
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      const response = await this.http.get<{data: {users: User[]}}>(`${this.server}/user/list`).toPromise();
      const allUsers = response?.data?.users || [];
      
      // Enhanced filtering with multiple role name formats and aliases
      const filteredUsers = allUsers.filter((user: User) => {
        const primaryRole = user.roleName?.toUpperCase() || '';
        const secondaryRole = user.primaryRoleName?.toUpperCase() || '';
        const rolesArray = user.roles?.map(r => String(r).toUpperCase()) || [];
        const searchRole = role.toUpperCase();
        
        // Role aliases for flexible matching
        const roleAliases: { [key: string]: string[] } = {
          'ATTORNEY': ['ROLE_ATTORNEY', 'LAWYER', 'ROLE_LAWYER', 'SENIOR_ATTORNEY', 'JUNIOR_ATTORNEY', 
                       'SENIOR_PARTNER', 'EQUITY_PARTNER', 'NON_EQUITY_PARTNER', 'MANAGING_PARTNER', 
                       'OF_COUNSEL', 'ASSOCIATE', 'SENIOR_ASSOCIATE', 'JUNIOR_ASSOCIATE'],
          'ROLE_ATTORNEY': ['ATTORNEY', 'LAWYER', 'ROLE_LAWYER', 'SENIOR_ATTORNEY', 'JUNIOR_ATTORNEY',
                            'SENIOR_PARTNER', 'EQUITY_PARTNER', 'NON_EQUITY_PARTNER', 'MANAGING_PARTNER',
                            'OF_COUNSEL', 'ASSOCIATE', 'SENIOR_ASSOCIATE', 'JUNIOR_ASSOCIATE'],
          'MANAGER': ['ROLE_MANAGER', 'SUPERVISOR', 'ROLE_SUPERVISOR', 'TEAM_LEAD', 'PRACTICE_MANAGER',
                      'SENIOR_PARTNER', 'EQUITY_PARTNER', 'MANAGING_PARTNER'],
          'ROLE_MANAGER': ['MANAGER', 'SUPERVISOR', 'ROLE_SUPERVISOR', 'TEAM_LEAD', 'PRACTICE_MANAGER',
                           'SENIOR_PARTNER', 'EQUITY_PARTNER', 'MANAGING_PARTNER'],
          'PARALEGAL': ['ROLE_PARALEGAL', 'LEGAL_ASSISTANT', 'ROLE_LEGAL_ASSISTANT', 'SENIOR_PARALEGAL'],
          'ROLE_PARALEGAL': ['PARALEGAL', 'LEGAL_ASSISTANT', 'ROLE_LEGAL_ASSISTANT', 'SENIOR_PARALEGAL'],
          'ADMIN': ['ROLE_ADMIN', 'ADMINISTRATOR', 'ROLE_ADMINISTRATOR', 'SYSADMIN', 'COO', 'CFO', 'IT_MANAGER'],
          'ROLE_ADMIN': ['ADMIN', 'ADMINISTRATOR', 'ROLE_ADMINISTRATOR', 'SYSADMIN', 'COO', 'CFO', 'IT_MANAGER']
        };
        
        // Get aliases for the search role
        const aliases = roleAliases[searchRole] || [];
        const allSearchTerms = [searchRole, ...aliases];
        
        // Multiple matching strategies
        const exactMatch = allSearchTerms.some(term => 
          primaryRole === term || secondaryRole === term
        );
        
        const rolesArrayMatch = rolesArray.some(userRole => 
          allSearchTerms.some(term => userRole === term)
        );
        
        const partialMatch = allSearchTerms.some(term => {
          const cleanTerm = term.replace('ROLE_', '');
          return primaryRole.includes(cleanTerm) || 
                 secondaryRole.includes(cleanTerm) ||
                 rolesArray.some(userRole => userRole.includes(cleanTerm));
        });
        
        // Special case: Include all active users for broader targeting if no specific matches
        const isActiveUser = user.enabled && user.notLocked;
        
        return (exactMatch || rolesArrayMatch || partialMatch) && isActiveUser;
      });
      
      return filteredUsers;
    } catch (error) {
      console.error('Failed to get users by role:', error);
      return [];
    }
  }

  /**
   * Get users by permission string (new method for permission-based targeting)
   */
  async getUsersByPermission(permission: string): Promise<User[]> {
    try {
      const response = await this.http.get<{data: {users: User[]}}>(`${this.server}/user/list`).toPromise();
      const allUsers = response?.data?.users || [];
      
      const filteredUsers = allUsers.filter((user: User) => {
        const permissions = user.permissions || '';
        const hasPermission = permissions.toUpperCase().includes(permission.toUpperCase());
        const isActiveUser = user.enabled && user.notLocked;
        
        return hasPermission && isActiveUser;
      });
      
      return filteredUsers;
    } catch (error) {
      console.error('Failed to get users by permission:', error);
      return [];
    }
  }

  /**
   * Get all eligible users for notifications (enhanced fallback)
   */
  async getAllEligibleUsers(): Promise<User[]> {
    try {
      const allUsers = await this.getAllUsers();
      
      // Return all active, enabled users as the most inclusive fallback
      const eligibleUsers = allUsers.filter(user => 
        user.enabled && user.notLocked
      );
      
      console.log(`🔍 Found ${eligibleUsers.length} eligible users for notifications`);
      
      return eligibleUsers;
    } catch (error) {
      console.error('Failed to get all eligible users:', error);
      return [];
    }
  }

  /**
   * Template methods for common notification scenarios
   */
  
  // Case Management Templates
  async notifyCaseAssigned(caseId: number, caseName: string, assignedToUserId: number): Promise<void> {
    const assignedUser = await this.getUser(assignedToUserId);
    const supervisors = await this.getSupervisors(assignedToUserId);
    
    if (!assignedUser) return;

    await this.sendNotification(
      NotificationCategory.CASE_MANAGEMENT,
      'Case Assigned',
      `You have been assigned to case "${caseName}"`,
      NotificationPriority.HIGH,
      {
        primaryUsers: [assignedUser],
        secondaryUsers: supervisors
      },
      `/legal/cases/details/${caseId}`,
      {
        entityId: caseId,
        entityType: 'case',
        additionalData: { caseName, assignedToUserId }
      }
    );
  }

  async notifyTaskAssigned(taskId: number, taskTitle: string, assignedToUserId: number, caseId?: number): Promise<void> {
    const assignedUser = await this.getUser(assignedToUserId);
    const supervisors = await this.getSupervisors(assignedToUserId);
    
    if (!assignedUser) return;

    await this.sendNotification(
      NotificationCategory.CASE_MANAGEMENT,
      'Task Assigned',
      `New task "${taskTitle}" has been assigned to you`,
      NotificationPriority.HIGH,
      {
        primaryUsers: [assignedUser],
        secondaryUsers: supervisors
      },
      caseId ? `/legal/cases/details/${caseId}` : `/case-management/tasks`,
      {
        entityId: taskId,
        entityType: 'task',
        additionalData: { taskTitle, assignedToUserId, caseId }
      }
    );
  }

  // CRM Templates
  async notifyLeadAssigned(leadId: number, leadName: string, assignedToUserId: number): Promise<void> {
    const assignedUser = await this.getUser(assignedToUserId);
    const salesManagers = await this.getUsersByRole('SALES_MANAGER');
    
    if (!assignedUser) return;

    await this.sendNotification(
      NotificationCategory.CRM,
      'Lead Assigned',
      `Lead "${leadName}" has been assigned to you`,
      NotificationPriority.HIGH,
      {
        primaryUsers: [assignedUser],
        secondaryUsers: salesManagers
      },
      `/crm/leads`,
      {
        entityId: leadId,
        entityType: 'lead',
        additionalData: { leadName, assignedToUserId }
      }
    );
  }

  async notifyNewIntakeSubmission(submissionId: number, submitterName: string, practiceArea: string): Promise<void> {
    const intakeTeam = await this.getUsersByRole('INTAKE_COORDINATOR');
    const attorneys = await this.getDepartmentMembers(practiceArea);

    await this.sendNotification(
      NotificationCategory.CRM,
      'New Intake Submission',
      `New ${practiceArea} submission received from ${submitterName}`,
      NotificationPriority.HIGH,
      {
        primaryUsers: intakeTeam,
        secondaryUsers: attorneys.slice(0, 3) // Limit to avoid spam
      },
      `/crm/intake-submissions`,
      {
        entityId: submissionId,
        entityType: 'intake_submission',
        additionalData: { submitterName, practiceArea }
      }
    );
  }

  // Admin & System Templates
  async notifyUserRoleChange(userId: number, oldRole: string, newRole: string): Promise<void> {
    const affectedUser = await this.getUser(userId);
    const admins = await this.getUsersByRole('ADMIN');
    const supervisors = await this.getSupervisors(userId);
    
    if (!affectedUser) return;

    await this.sendNotification(
      NotificationCategory.ADMIN,
      'User Role Updated',
      `${affectedUser.firstName} ${affectedUser.lastName}'s role changed from ${oldRole} to ${newRole}`,
      NotificationPriority.HIGH,
      {
        primaryUsers: [affectedUser],
        secondaryUsers: [...admins, ...supervisors]
      },
      `/admin/users/${userId}`,
      {
        entityId: userId,
        entityType: 'user',
        previousState: { role: oldRole },
        newState: { role: newRole },
        additionalData: { oldRole, newRole }
      }
    );
  }

  async notifySystemMaintenance(message: string, scheduledTime?: string): Promise<void> {
    const allUsers = await this.getUsersByRole('USER');
    const admins = await this.getUsersByRole('ADMIN');

    await this.sendNotification(
      NotificationCategory.SYSTEM,
      'System Maintenance Notification',
      scheduledTime ? `${message} Scheduled for: ${scheduledTime}` : message,
      NotificationPriority.HIGH,
      {
        primaryUsers: allUsers,
        secondaryUsers: admins
      },
      `/dashboard`,
      {
        entityType: 'system_maintenance',
        additionalData: { message, scheduledTime }
      }
    );
  }

  async notifySecurityAlert(alertType: string, description: string, affectedUserId?: number): Promise<void> {
    const securityTeam = await this.getUsersByRole('SECURITY_ADMIN');
    const admins = await this.getUsersByRole('ADMIN');
    let affectedUser = null;
    
    if (affectedUserId) {
      affectedUser = await this.getUser(affectedUserId);
    }

    await this.sendNotification(
      NotificationCategory.SYSTEM,
      `Security Alert: ${alertType}`,
      `${description}${affectedUser ? ` - User: ${affectedUser.firstName} ${affectedUser.lastName}` : ''}`,
      NotificationPriority.CRITICAL,
      {
        primaryUsers: securityTeam,
        secondaryUsers: admins
      },
      `/admin/security`,
      {
        entityId: affectedUserId,
        entityType: 'security_alert',
        additionalData: { alertType, description, affectedUserId }
      }
    );
  }

  async notifyDataExport(exportType: string, requestedBy: number): Promise<void> {
    const requester = await this.getUser(requestedBy);
    const admins = await this.getUsersByRole('ADMIN');
    const complianceTeam = await this.getUsersByRole('COMPLIANCE_OFFICER');

    if (!requester) return;

    await this.sendNotification(
      NotificationCategory.ADMIN,
      'Data Export Request',
      `${exportType} export requested by ${requester.firstName} ${requester.lastName}`,
      NotificationPriority.HIGH,
      {
        primaryUsers: admins,
        secondaryUsers: complianceTeam
      },
      `/admin/exports`,
      {
        entityId: requestedBy,
        entityType: 'data_export',
        additionalData: { exportType, requestedBy: requester.email }
      }
    );
  }

  async notifyBudgetThreshold(amount: number, threshold: number, department: string): Promise<void> {
    const financeTeam = await this.getUsersByRole('FINANCE_MANAGER');
    const departmentManagers = await this.getDepartmentMembers(department);

    await this.sendNotification(
      NotificationCategory.ADMIN,
      'Budget Threshold Exceeded',
      `${department} department has exceeded ${threshold}% of budget with $${amount}`,
      NotificationPriority.HIGH,
      {
        primaryUsers: financeTeam,
        secondaryUsers: departmentManagers
      },
      `/admin/budget`,
      {
        entityType: 'budget_alert',
        additionalData: { amount, threshold, department }
      }
    );
  }

  // Utility methods
  private getAllRecipientIds(recipients: NotificationRecipients): number[] {
    const allUsers = [
      ...recipients.primaryUsers,
      ...(recipients.secondaryUsers || [])
    ].filter(user => !recipients.excludeUsers?.includes(user.id));
    
    return allUsers.map(user => user.id);
  }

  private async getUser(userId: number): Promise<User | null> {
    try {
      const response = await this.http.get<{data: {users: User[]}}>(`${this.server}/user/list`).toPromise();
      const allUsers = response?.data?.users || [];
      const user = allUsers.find(u => u.id === userId);
      return user || null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  private getNotificationIcon(category: NotificationCategory): string {
    const iconMap: Record<NotificationCategory, string> = {
      [NotificationCategory.CASE_MANAGEMENT]: '/assets/icons/case-icon.png',
      [NotificationCategory.CRM]: '/assets/icons/crm-icon.png',
      [NotificationCategory.TIME_TRACKING]: '/assets/icons/time-icon.png',
      [NotificationCategory.BILLING]: '/assets/icons/billing-icon.png',
      [NotificationCategory.CALENDAR]: '/assets/icons/calendar-icon.png',
      [NotificationCategory.FILES]: '/assets/icons/file-icon.png',
      [NotificationCategory.SYSTEM]: '/assets/icons/system-icon.png',
      [NotificationCategory.ADMIN]: '/assets/icons/admin-icon.png'
    };
    return iconMap[category] || '/assets/icons/default-notification.png';
  }

  private getBadgeCount(category: NotificationCategory): string {
    // This could be enhanced to show actual unread counts per category
    return '1';
  }

  private getDefaultUrl(category: NotificationCategory): string {
    const urlMap: Record<NotificationCategory, string> = {
      [NotificationCategory.CASE_MANAGEMENT]: '/case-management',
      [NotificationCategory.CRM]: '/crm',
      [NotificationCategory.TIME_TRACKING]: '/time-tracking',
      [NotificationCategory.BILLING]: '/billing',
      [NotificationCategory.CALENDAR]: '/calendar',
      [NotificationCategory.FILES]: '/file-manager',
      [NotificationCategory.SYSTEM]: '/dashboard',
      [NotificationCategory.ADMIN]: '/admin'
    };
    return urlMap[category] || '/dashboard';
  }
}