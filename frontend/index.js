// Toast
const toast = document.getElementsByClassName('toast')[0];

// Forms
const loginForm = document.getElementById('loginForm');

// Inputs
const emailInput = document.getElementById('email');
const tokenInput = document.getElementById('token');
const subscriptionInput = document.getElementById('subscription');

// Containers
const validateTokenContainer = document.getElementById('validateToken');
const validateSubscriptionContainer = document.getElementById('validateSubscription');

// Buttons
const sendEmailButton = document.getElementById('sendEmailButton');

// Methods
const setValue = (event, input) => input.value = event.target.value;

const showToast = (message, type = 'success', seconds = 4) => {
  Toastify({
    text: message,
    duration: seconds * 1000,
    destination: "https://github.com/apvarun/toastify-js",
    newWindow: true,
    gravity: "bottom",
    position: "center",
    stopOnFocus: true,
    className: `${type} toast`,
    offset: {
      y: 30
    },
  }).showToast();
}

const openModal = () => {
  document.getElementById('modal').classList.add('active');
  document.getElementById('errorMessage').style.display = 'none'; // Oculta el mensaje de error
  document.getElementById('tokenInput').value = ''; // Limpia el campo de texto
}

// Cerrar el modal
function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

const sendEmail = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const subscription = urlParams.get('subscription');
    if (!subscription) { showToast('Subscription not found', 'error'); return; }
    const formData = new FormData(loginForm);
    formData.append('subscription', subscription);
    const response = await fetch('http://localhost:3000/email/send', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });

    const message = (await response.json()).message

    if (response.ok) {
      showToast(message, 'success', 6);
      openModal();
      return;
    }

    showToast(message, 'error');
  } catch (err) { }
};

const validateToken = async () => {
  try {
    const formData = new FormData(loginForm);
    const response = await fetch('http://localhost:3000/token/validate', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });

    const message = (await response.json()).message
    if (response.ok) {
      showToast(message, 'success');

      // Se debe mostrar el input del token y los botones de validar token y cambiar de email
      tokenInput.readOnly = true;
      validateTokenContainer.classList.add('hidden');
      validateSubscriptionContainer.classList.remove('hidden');
      subscriptionInput.disabled = false;
      subscriptionInput.classList.remove('hidden');
      return;
    }

    showToast(message, 'error');
  } catch (err) { }
};

const changeEmail = async () => {
  try {
    const formData = new FormData(loginForm);
    const response = await fetch('http://localhost:3000/email/send', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });

    const message = (await response.json()).message
    showToast(message, response.ok ? 'success' : 'error');
  } catch (err) { }
};

const validateSubscription = async () => {
  try {
    const formData = new FormData(loginForm);
    const response = await fetch('http://localhost:3000/subscription/validate', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });

    const message = (await response.json()).message
    showToast(message, response.ok ? 'success' : 'error');
  } catch (err) { }
};

window.onload = () => { document.getElementById('subscriptionTitle').innerHTML = `Subscription ${window.location.search.split('=')[1]}`; }