

// Function to change the display state of the div.menu-superior class
// (Hamburger Menu) from div.logo-hamburger
function changeMenuSuperior() {
	// Get the current display state of the class
	const display = document.getElementsByClassName('menu-superior')[0].style.display;

	// Get the content of div.logo-hamburger
	const logoHamburger = document.getElementsByClassName('logo-hamburger')[0];

	// Show or hide the menu based on the class state
	if (display === 'none') {
		document.getElementsByClassName('menu-superior')[0].style.display = 'initial';

		// Change the content of div.logo-hamburger to ☒;
		logoHamburger.innerHTML = '☒';
	} else {
		document.getElementsByClassName('menu-superior')[0].style.display = 'none';

		// Change the content of div.logo-hamburger to ☰
		logoHamburger.innerHTML = '☰';
	}
}

// Fns for the services secction (TODO)


/* Emulating PHP's include() Function to load the content of elements with the
source attribute type:

<div source="http://mydomain.com/myfile.html"></div>
*/
function loadContent() {
  let divElements = document.querySelectorAll('div[source]');
  
  divElements.forEach(function(div) {
    let sourceURL = div.getAttribute('source');
    
    fetch(sourceURL, { cache: 'no-store' })
      .then(response => response.text())
      .then(html => {
        div.innerHTML = html;
      })
      .catch(error => {
        console.error('Error loading file:', error);
      });
  });
}


// Add event listeners to avoid cluttering the theme
// Note: If any function fails, the subsequent ones will not be executed
// Remember this mf!!
document.addEventListener('DOMContentLoaded', function() {
	console.log("Inicio de carga de funciones para el objeto document")
	htmlTableOfContents()
	loadContent()
	console.log("Fin de carga de funciones para el objeto document")
});