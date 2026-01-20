// Select all links starting with http
document.querySelectorAll('a[href^="http"]').forEach(link => {
    link.setAttribute('target', '_blank'); // open in new tab
    link.setAttribute('rel', 'noopener noreferrer'); // security best practice
});
