package com.rodrigofranchini.pokedextracker.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

// One place builds the auth cookie, so login, register and logout cannot
// disagree about its flags -- a logout that misses one leaves the user signed in.
@Component
public class AuthCookieFactory {
    public static final String NAME = "token";

    private final Duration expiry;
    private final boolean secure;

    public AuthCookieFactory(@Value("${app.auth.token-expiry}") Duration expiry,
                             @Value("${app.auth.cookie-secure}") boolean secure) {
        this.expiry = expiry;
        this.secure = secure;
    }

    public ResponseCookie create(String token) {
        return build(token, expiry);
    }

    public ResponseCookie clear() {
        return build("", Duration.ZERO);
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                // httpOnly keeps the token out of reach of JavaScript, so XSS
                // cannot steal it.
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
    }
}
