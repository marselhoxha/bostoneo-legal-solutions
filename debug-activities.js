// BULLETPROOF Activities Debug Script
// Open browser console and paste this to test the new loading system

console.log('🚀 Testing New Bulletproof Activities Loading System...');

// Test 1: Check loading states
function checkLoadingStates() {
  const component = angular.getComponent(document.querySelector('app-activities'));
  if (component) {
    console.log('✅ Component found');
    console.log('🔍 Current loading states:', {
      loading: component.loading,
      statisticsLoading: component.statisticsLoading,
      activityCountsLoading: component.activityCountsLoading,
      activitiesCount: component.activities?.length || 0,
      statisticsExists: !!component.statistics,
      activityCountsExists: !!component.activityCounts
    });
    return true;
  } else {
    console.log('❌ Component not found');
    return false;
  }
}

// Test 2: Force reset if stuck
function forceReset() {
  const component = angular.getComponent(document.querySelector('app-activities'));
  if (component) {
    console.log('🔄 Force resetting all loading states...');
    component.resetAllLoadingStates();
    console.log('✅ All loading states reset');
  }
}

// Test 3: Test manual refresh
function testManualRefresh() {
  const component = angular.getComponent(document.querySelector('app-activities'));
  if (component) {
    console.log('🔄 Testing manual refresh...');
    component.manualRefreshActivities(true);
    console.log('✅ Manual refresh triggered');
  }
}

// Test 4: Check for infinite loading (should never happen now)
function monitorLoadingStates() {
  console.log('🔍 Monitoring loading states for 10 seconds...');
  const component = angular.getComponent(document.querySelector('app-activities'));
  if (!component) return;
  
  let checks = 0;
  const interval = setInterval(() => {
    checks++;
    const loading = component.loading || component.statisticsLoading || component.activityCountsLoading;
    console.log(`Check ${checks}/10: Any loading = ${loading}`);
    
    if (checks >= 10) {
      clearInterval(interval);
      console.log('✅ Monitoring complete - no infinite loading detected!');
    }
  }, 1000);
}

// Auto-run tests
console.log('🏃 Running automated tests...');
checkLoadingStates();

// Make functions available
window.activitiesDebugNew = {
  checkLoadingStates,
  forceReset,
  testManualRefresh,
  monitorLoadingStates
};

console.log('✅ New debug functions available as window.activitiesDebugNew');
console.log('💡 Try: activitiesDebugNew.checkLoadingStates()');
console.log('💡 Emergency: activitiesDebugNew.forceReset()');

// Debug script for testing permission assignment functionality
console.log('=== Permission Assignment Debug Script ===');

// Function to test API endpoints
async function testPermissionAPI() {
    try {
        console.log('Testing permission assignment functionality...');
        
        // Get the current user's token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found. Please login first.');
            return;
        }
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        // Test 1: Get all roles
        console.log('1. Testing GET /api/rbac/roles...');
        const rolesResponse = await fetch('http://localhost:8085/api/rbac/roles', {
            method: 'GET',
            headers: headers
        });
        
        if (rolesResponse.ok) {
            const rolesData = await rolesResponse.json();
            console.log('✅ Roles loaded successfully:', rolesData);
            
            // Test 2: Get permissions
            console.log('2. Testing GET /api/rbac/permissions...');
            const permissionsResponse = await fetch('http://localhost:8085/api/rbac/permissions', {
                method: 'GET',
                headers: headers
            });
            
            if (permissionsResponse.ok) {
                const permissionsData = await permissionsResponse.json();
                console.log('✅ Permissions loaded successfully:', permissionsData);
                
                // Test 3: Get specific role with permissions
                if (rolesData.data && rolesData.data.roles && rolesData.data.roles.length > 0) {
                    const firstRole = rolesData.data.roles[0];
                    console.log('3. Testing GET /api/rbac/roles/' + firstRole.id + '...');
                    
                    const roleResponse = await fetch(`http://localhost:8085/api/rbac/roles/${firstRole.id}`, {
                        method: 'GET',
                        headers: headers
                    });
                    
                    if (roleResponse.ok) {
                        const roleData = await roleResponse.json();
                        console.log('✅ Role with permissions loaded:', roleData);
                        
                        // Test 4: Test permission assignment
                        if (permissionsData.data && permissionsData.data.permissions && permissionsData.data.permissions.length > 0) {
                            const testPermissionIds = permissionsData.data.permissions.slice(0, 3).map(p => p.id);
                            console.log('4. Testing POST /api/rbac/roles/' + firstRole.id + '/permissions...');
                            console.log('Test permission IDs:', testPermissionIds);
                            
                            const assignResponse = await fetch(`http://localhost:8085/api/rbac/roles/${firstRole.id}/permissions`, {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify(testPermissionIds)
                            });
                            
                            if (assignResponse.ok) {
                                const assignData = await assignResponse.json();
                                console.log('✅ Permission assignment successful:', assignData);
                            } else {
                                const errorText = await assignResponse.text();
                                console.error('❌ Permission assignment failed:', assignResponse.status, errorText);
                            }
                        }
                    } else {
                        const errorText = await roleResponse.text();
                        console.error('❌ Role loading failed:', roleResponse.status, errorText);
                    }
                }
            } else {
                const errorText = await permissionsResponse.text();
                console.error('❌ Permissions loading failed:', permissionsResponse.status, errorText);
            }
        } else {
            const errorText = await rolesResponse.text();
            console.error('❌ Roles loading failed:', rolesResponse.status, errorText);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Function to test Angular component functionality
function testAngularComponents() {
    console.log('Testing Angular components...');
    
    // Check if Angular is available
    if (typeof ng === 'undefined') {
        console.log('Angular not available in console. Testing from browser console...');
        return;
    }
    
    // Test permission assignment component
    const permissionComponents = document.querySelectorAll('app-permission-assignment');
    console.log('Permission assignment components found:', permissionComponents.length);
    
    // Test role admin component
    const roleAdminComponents = document.querySelectorAll('app-role-admin');
    console.log('Role admin components found:', roleAdminComponents.length);
    
    // Check for common CSS classes
    const expandIndicators = document.querySelectorAll('.expand-indicator');
    console.log('Expand indicators found:', expandIndicators.length);
    
    const rotatedArrows = document.querySelectorAll('.rotate-180');
    console.log('Rotated arrows found:', rotatedArrows.length);
}

// Function to check CSS and animations
function testCSSAnimations() {
    console.log('Testing CSS animations...');
    
    // Check if rotate-180 class exists
    const style = document.createElement('style');
    style.textContent = '.test-rotate { transform: rotate(180deg); transition: transform 0.3s ease; }';
    document.head.appendChild(style);
    
    const testElement = document.createElement('div');
    testElement.className = 'test-rotate';
    document.body.appendChild(testElement);
    
    const computedStyle = window.getComputedStyle(testElement);
    console.log('CSS transform test:', computedStyle.transform);
    console.log('CSS transition test:', computedStyle.transition);
    
    document.body.removeChild(testElement);
    document.head.removeChild(style);
}

// Run tests
console.log('Starting debug tests...');
testAngularComponents();
testCSSAnimations();

// Export test function for manual execution
window.testPermissionAPI = testPermissionAPI;
console.log('To test API functionality, run: testPermissionAPI()');
console.log('=== Debug Script Complete ==='); 
 
 
 
 
 
 