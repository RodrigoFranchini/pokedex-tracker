package com.rodrigofranchini.pokedextracker.dtos;

import jakarta.validation.constraints.NotBlank;

// Body of POST /api/auth/login.
public record LoginRequest(

        @NotBlank(message = "Email is required")
        String email,

        @NotBlank(message = "Password is required")
        String password
) {
}
