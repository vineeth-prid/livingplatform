# Shared security headers for the SPA images (included by spa.conf).
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), geolocation=(), microphone=(), payment=(self \"https://checkout.razorpay.com\")" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: __API_ORIGIN__; font-src 'self' data:; connect-src 'self' https: wss: __API_ORIGIN__; frame-src https://api.razorpay.com https://checkout.razorpay.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
