document.addEventListener('DOMContentLoaded', async () => {
  const notificationCheckboxes = document.querySelectorAll('.notification-options input[type="checkbox"]');
  const logoutButton = document.getElementById('logoutButton');

  notificationCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const minutes = parseInt(checkbox.value);
      const isEnabled = checkbox.checked;
      window.electronAPI.setNotificationTime(minutes, isEnabled);
    });
  });

 
}); 