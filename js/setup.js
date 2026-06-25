const actionButton = document.getElementById('actionButton');
const message = document.getElementById('message');

if (actionButton && message) {
  actionButton.addEventListener('click', () => {
    message.textContent = 'คุณเพิ่งคลิกปุ่มแล้ว!';
    message.classList.add('active');
  });
}
