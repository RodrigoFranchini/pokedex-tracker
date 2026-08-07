package com.rodrigofranchini.pokedextracker.dtos;

import com.rodrigofranchini.pokedextracker.entities.DexProgress;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

// GET and PUT /api/progress/{game}/{dex}.
public record ProgressResponse(String game, String dex, List<Integer> caught, Instant updatedAt) {

    public static ProgressResponse from(DexProgress progress) {
        return new ProgressResponse(
                progress.getId().getGame(),
                progress.getId().getDex(),
                Arrays.stream(progress.getCaught()).boxed().toList(),
                progress.getUpdatedAt());
    }

    // A dex nobody has touched yet is empty progress, not a missing resource.
    public static ProgressResponse empty(String game, String dex) {
        return new ProgressResponse(game, dex, List.of(), null);
    }
}
