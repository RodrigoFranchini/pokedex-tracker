package com.rodrigofranchini.pokedextracker.config;

import com.rodrigofranchini.pokedextracker.repositories.UserRepository;
import com.rodrigofranchini.pokedextracker.services.JwtService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

// Reads the auth cookie on every request and, when it holds a valid token,
// marks the request as authenticated.
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        readCookie(request)
                .flatMap(jwtService::parseUserId)
                // Looked up rather than trusted from the token, so deleting a
                // user takes effect immediately instead of at token expiry.
                .flatMap(userRepository::findById)
                .ifPresent(user -> {
                    var authentication = new UsernamePasswordAuthenticationToken(user, null, java.util.List.of());
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });

        // Always continues. An absent or bad token is an anonymous request, and
        // whether that is allowed is SecurityConfig's decision, not this filter's.
        filterChain.doFilter(request, response);
    }

    private Optional<String> readCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(cookie -> AuthCookieFactory.NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }
}
