package com.rodrigofranchini.pokedextracker.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

// Body of PUT /api/progress/{game}/{dex}. The whole list, not a delta.
public record ProgressRequest(

        @NotNull(message = "Caught list is required")
        List<@NotNull @Positive Integer> caught
) {
}
