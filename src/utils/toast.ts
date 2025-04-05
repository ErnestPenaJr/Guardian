import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  }
});

export const showToast = {
  success: (message: string) => Toast.fire({
    icon: 'success',
    title: message,
    background: '#27AE60',
    color: '#ffffff'
  }),
  error: (message: string) => Toast.fire({
    icon: 'error',
    title: message,
    background: '#C10000',
    color: '#ffffff'
  }),
  warning: (message: string) => Toast.fire({
    icon: 'warning',
    title: message,
    background: '#E2B93B',
    color: '#ffffff'
  }),
  info: (message: string) => Toast.fire({
    icon: 'info',
    title: message,
    background: '#2F8CED',
    color: '#ffffff'
  })
};

export const showAlert = {
  confirm: async (options: {
    title: string;
    text: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
  }) => {
    return Swal.fire({
      title: options.title,
      text: options.text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2EBCBC',
      cancelButtonColor: '#C10000',
      confirmButtonText: options.confirmButtonText || 'Yes',
      cancelButtonText: options.cancelButtonText || 'Cancel'
    });
  },
  success: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonColor: '#2EBCBC'
    });
  },
  error: (title: string, text?: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonColor: '#2EBCBC'
    });
  }
};