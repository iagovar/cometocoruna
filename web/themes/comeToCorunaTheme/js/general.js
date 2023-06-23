

// Función para cambiar el estado del display de la clase div.menu-superior
// (Hamburger Menu) desde div.logo-hamburger
function changeMenuSuperior() {
	// Obtenemos el estado del display de la clase
	const display = document.getElementsByClassName('menu-superior')[0].style.display;

	// obtenemos el contenido de div.logo-hamburger
	const logoHamburger = document.getElementsByClassName('logo-hamburger')[0];

	// Mostramos u ocultamos el menú dependiendo del estado de la clase
	if (display === 'none') {
		document.getElementsByClassName('menu-superior')[0].style.display = 'initial';

		// Cambiamos el contenido de div.logo-hamburger a ☒;
		logoHamburger.innerHTML = '☒';
	} else {
		document.getElementsByClassName('menu-superior')[0].style.display = 'none';

		// Cambiamos el contenido de div.logo-hamburger a ☰
		logoHamburger.innerHTML = '☰';
	}
}

// Funciones para las pestañas de la tabla de servicios

// Función para cargar URL Externa
function cargarServicio(servicio) {
	// Obtiene una lista de todos los divs dentro de .contenido-servicios
	
}
  

