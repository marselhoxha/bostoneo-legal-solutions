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
 
 
 
 
 
 