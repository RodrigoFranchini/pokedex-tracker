package com.rodrigofranchini.pokedextracker.dtos;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Body of POST /api/auth/register.
public record RegisterRequest(

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be a valid address")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        String password
) {
    /*
     * Trim before validation, not in the service: @Email runs at this boundary,
     * so a pasted address with a trailing space would be rejected as malformed
     * long before the service ever saw it. The password is left untouched --
     * surrounding spaces there are legitimate characters.
     */
    public RegisterRequest {
        if (email != null) {
            email = email.trim();
        }
    }
}
