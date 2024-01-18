/*jslint
    white: true,
    browser: true,
    vars: true
*/

/**
 * Generates a table of contents for your document based on the headings
 *  present. Anchors are injected into the document and the
 *  entries in the table of contents are linked to them. The table of
 *  contents will be generated inside of the first element with the id `toc`.
 * @param {HTMLDOMDocument} documentRef Optional A reference to the document
 *  object. Defaults to `document`.
 * @author Matthew Christopher Kastor-Inare III
 * @version 20130726
 * @example
 * // call this after the page has loaded
 * htmlTableOfContents();
 */
function htmlTableOfContents (documentRef) {
    try {
        var documentRef = documentRef || document;
        var toc = documentRef.getElementById('toc');

        // No incluímos el h1 en el TOC porque sino incluye el title
        var headings = [].slice.call(documentRef.body.querySelectorAll('h1, h2, h3, h4, h5, h6'));

        // Generamos atributos en los headings para que sean enlazables
        headings.forEach(function (heading, index) {
            var anchor = documentRef.createElement('a');
            anchor.setAttribute('name', 'toc' + index);
            anchor.setAttribute('id', 'toc' + index);
            
            var link = documentRef.createElement('a');
            link.setAttribute('href', '#toc' + index);
            link.textContent = heading.textContent;
            
            var div = documentRef.createElement('li');
            div.setAttribute('class', heading.tagName.toLowerCase());
            
            div.appendChild(link);
            toc.appendChild(div);
            heading.parentNode.insertBefore(anchor, heading);
        });
    } catch(err) {console.error(err);}
}

try {
     module.exports = htmlTableOfContents;
} catch (err) {
    // module.exports is not defined
}