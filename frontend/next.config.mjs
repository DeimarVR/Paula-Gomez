/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    /**
     * Las URLs de la galería y de las fotos de seguimiento las pega el equipo
     * del centro desde el panel, así que no se conocen de antemano. Si un
     * dominio no está permitido aquí, `next/image` lanza una excepción y tumba
     * la página entera con un 500 — un precio demasiado alto por una foto.
     *
     * Por eso se aceptan hosts HTTPS arbitrarios. Cuando el centro tenga
     * definido su proveedor de almacenamiento definitivo, cambia el `'**'` por
     * ese dominio concreto: el optimizador de imágenes deja de poder usarse
     * como proxy hacia terceros y se gana seguridad sin perder nada.
     */
    remotePatterns: [
      // Hosts conocidos del feed de Instagram.
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      // Comodín para las imágenes que se cargan desde el panel.
      { protocol: 'https', hostname: '**' },
    ],
    // Las imágenes vienen de terceros: no se permite SVG, que puede ejecutar scripts.
    dangerouslyAllowSVG: false,
  },

  /**
   * Cabeceras de seguridad.
   *
   * Son instrucciones al navegador de quien visita, no un cortafuegos: no
   * impiden que alguien ataque el servidor, cierran las formas de usar el
   * sitio contra su propia gente. Van todas aquí porque una cabecera que falta
   * no da ningún error —simplemente no protege— y así están a la vista.
   */
  async headers() {
    return [
      {
        source: '/:ruta*',
        headers: [
          /**
           * Nadie puede meter el sitio dentro de un marco en otra página.
           *
           * Evita el «clickjacking»: una página ajena que pone la nuestra
           * invisible encima de sus botones, de forma que quien cree estar
           * pulsando ahí en realidad está pulsando aquí, ya con su sesión
           * abierta. Con un panel que cobra y cierra caja, eso importa.
           */
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },

          /**
           * El navegador respeta el tipo que declara el servidor y no adivina.
           *
           * Sin esto, un archivo subido puede acabar interpretándose como algo
           * distinto de lo que es —un texto que el navegador decide leer como
           * código— por el simple parecido de su contenido.
           */
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          /**
           * Al salir del sitio se manda el dominio, nunca la dirección entera.
           *
           * Los enlaces de seguimiento del paciente llevan su token EN la
           * dirección. Sin esta cabecera, si desde ahí se pulsa un enlace a
           * otro sitio, ese sitio recibe la dirección completa —token
           * incluido— en la cabecera `Referer`.
           */
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          /** El sitio no usa cámara, micrófono ni ubicación: se apagan. */
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },

          /**
           * Siempre por HTTPS durante un año, incluso si alguien escribe la
           * dirección a mano con http.
           */
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        // El panel no tiene nada que hacer en un buscador.
        source: '/admin/:ruta*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
