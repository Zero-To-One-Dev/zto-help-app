// Toast
const toast = document.getElementsByClassName('toast')[0];

// Forms
const loginForm = document.getElementById('loginForm');

// Inputs
const emailInput = document.getElementById('email');
const tokenInput = document.getElementById('token');
const orderInput = document.getElementById('order');

// Containers
const validateTokenContainer = document.getElementById('validateToken');
const validateOrderContainer = document.getElementById('validateOrder');

// Buttons
const sendEmailButton = document.getElementById('sendEmailButton');

// Methods
const setValue = (event, input) => input.value = event.target.value;

const showToast = (message, type = 'success') => {
  toast.innerHTML = message;
  toast.classList.add(type);
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.remove(type);
  }, 3000);
}

const sendEmail = async () => {
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

    if (response.ok) {
      showToast(message, 'success');

      // Se debe mostrar el input del token y los botones de validar token y cambiar de email
      emailInput.readOnly = true;
      sendEmailButton.classList.add('hidden');
      validateTokenContainer.classList.remove('hidden');
      tokenInput.disabled = false;
      tokenInput.classList.remove('hidden');
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
      validateOrderContainer.classList.remove('hidden');
      orderInput.disabled = false;
      orderInput.classList.remove('hidden');
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

const validateOrder = async () => {
  try {
    const formData = new FormData(loginForm);
    const response = await fetch('http://localhost:3000/order/validate', {
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
