package com.rodrigofranchini.pokedextracker.controllers;

import com.rodrigofranchini.pokedextracker.dtos.ProgressRequest;
import com.rodrigofranchini.pokedextracker.dtos.ProgressResponse;
import com.rodrigofranchini.pokedextracker.entities.User;
import com.rodrigofranchini.pokedextracker.services.ProgressService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {
    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    // GET => Caught list for one dex. The user comes from the cookie, never
    // from the URL, so there is no way to ask for someone else's progress.
    @GetMapping("/{game}/{dex}")
    public ProgressResponse get(@AuthenticationPrincipal User user,
                                @PathVariable String game,
                                @PathVariable String dex){
        return progressService.find(user, game, dex)
                .map(ProgressResponse::from)
                .orElseGet(() -> ProgressResponse.empty(game, dex));
    }

    // PUT => Replaces the caught list wholesale.
    @PutMapping("/{game}/{dex}")
    public ProgressResponse put(@AuthenticationPrincipal User user,
                                @PathVariable String game,
                                @PathVariable String dex,
                                @Valid @RequestBody ProgressRequest request){
        return ProgressResponse.from(progressService.replaceCaught(user, game, dex, request.caught()));
    }
}
