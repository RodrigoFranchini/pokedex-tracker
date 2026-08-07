package com.rodrigofranchini.pokedextracker.dtos;

// Body returned for handled failures. The HTTP status carries the category,
// so this only has to say what went wrong in words.
public record ErrorResponse(String message) {
}
