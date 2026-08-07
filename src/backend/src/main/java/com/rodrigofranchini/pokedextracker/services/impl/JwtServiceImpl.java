package com.rodrigofranchini.pokedextracker.services.impl;

import com.rodrigofranchini.pokedextracker.entities.User;
import com.rodrigofranchini.pokedextracker.services.JwtService;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Service
public class JwtServiceImpl implements JwtService {
    private final SecretKey key;
    private final Duration expiry;

    public JwtServiceImpl(@Value("${app.auth.jwt-secret}") String secret,
                          @Value("${app.auth.token-expiry}") Duration expiry) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiry = expiry;
    }

    @Override
    public String generateToken(User user) {
        Instant now = Instant.now();
        // Only the id goes in. A JWT is signed, not encrypted -- anyone holding
        // it can read the payload.
        return Jwts.builder()
                .subject(user.getId().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expiry)))
                .signWith(key)
                .compact();
    }

    @Override
    public Optional<UUID> parseUserId(String token) {
        try {
            String subject = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();
            return Optional.of(UUID.fromString(subject));
        } catch (JwtException | IllegalArgumentException e) {
            // A bad token is an ordinary anonymous request, not a server error.
            return Optional.empty();
        }
    }
}
