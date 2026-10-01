<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<section class="hero sf-poster-hero" aria-labelledby="sf-hero-title">
    <img class="sf-hero-art" src="<?php echo esc_url( get_stylesheet_directory_uri() . '/assets/statefall-hero-v1.png' ); ?>" width="1672" height="941" fetchpriority="high" alt="Cinematic illustration of a battleship cutting through rough seas beneath a fighter jet flying head-on.">
    <div class="container sf-hero-content"><div class="sf-hero-copy">
        <span class="eyebrow">Free to play &middot; no install &middot; no account needed</span>
        <h1 id="sf-hero-title">A real-time Risk.<br>Start small, eat your <span class="accent">neighbours</span>, hold the world.</h1>
        <p class="lede"><?php echo esc_html( get_theme_mod( 'statefall_hero_tagline', 'You start as one small nation on a map of a hundred countries. Race nine rival nations to hold 72% of the land — build cities, factories and ports, then fight for the rest with armies, navies, air power and missiles. A match runs 15–25 minutes.' ) ); ?></p>
        <div class="hero-ctas">
            <a class="btn btn-primary btn-lg" href="<?php echo esc_url( home_url( '/play/' ) ); ?>">Play now — it's free</a>
            <a class="btn btn-ghost btn-lg" href="#how-it-plays">See how it plays</a>
        </div>
        <p class="hero-note">Runs instantly in your browser tab. <strong>No download, no account, no ads.</strong></p>
    </div></div>
</section>
