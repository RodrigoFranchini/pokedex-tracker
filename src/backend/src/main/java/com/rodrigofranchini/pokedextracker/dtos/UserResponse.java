package com.rodrigofranchini.pokedextracker.dtos;

import com.rodrigofranchini.pokedextracker.entities.User;

import java.util.UUID;

// GET /api/me.
public record UserResponse(UUID id, String email) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail());
    }
}
