

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


/* Emulando el include() de PHP
Función para cargar el contenido de los elementos <div> con el atributo source
tipo:

<div source="http://midominio.com/miarchivo.html"></div>
*/
function loadContent() {
  var divElements = document.querySelectorAll('div[source]');
  
  divElements.forEach(function(div) {
    var sourceURL = div.getAttribute('source');
    
    fetch(sourceURL, { cache: 'no-store' })
      .then(response => response.text())
      .then(html => {
        div.innerHTML = html;
      })
      .catch(error => {
        console.error('Error al cargar el contenido:', error);
      });
  });
}


// Añadimos los event listeners para no llenar el theme de basura
// Ojo, si falla alguna función, no se ejecutarán las siguientes
// recuérdalo

document.addEventListener('DOMContentLoaded', function() {
	console.log("Inicio de carga de funciones para el objeto document")
  htmlTableOfContents()
  loadContent()
  console.log("Fin de carga de funciones para el objeto document")
});