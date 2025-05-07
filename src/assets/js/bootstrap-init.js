// Initialize all Bootstrap dropdowns
document.addEventListener('DOMContentLoaded', function() {
  // Enable dropdown menus
  var dropdownElementList = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
  var dropdownList = dropdownElementList.map(function(dropdownToggleEl) {
    return new bootstrap.Dropdown(dropdownToggleEl);
  });

  // Enable tooltips
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  var tooltipList = tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Re-initialize dropdowns in dynamically loaded content
  document.addEventListener('click', function(event) {
    if (event.target && event.target.getAttribute('data-bs-toggle') === 'dropdown') {
      var dropdownToggle = new bootstrap.Dropdown(event.target);
      dropdownToggle.toggle();
    }
  });
});
