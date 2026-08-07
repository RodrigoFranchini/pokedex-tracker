package com.rodrigofranchini.pokedextracker.services;

import com.rodrigofranchini.pokedextracker.entities.User;

import java.util.Optional;
import java.util.UUID;

public interface JwtService {

    String generateToken(User user);

    // Empty when the token is missing, expired, tampered with or unreadable.
    Optional<UUID> parseUserId(String token);
}
