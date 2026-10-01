<?php $art = statefall_map_art( $map['slug'] ); ?>
<figure style="margin:0 0 32px">
    <div class="map-hero"><img src="<?php echo esc_url( home_url( $art['main'] ) ); ?>" width="<?php echo (int) $art['width']; ?>" height="<?php echo (int) $art['height']; ?>" alt="<?php echo esc_attr( $map['name'] . ' gameplay, zoomed in to show textured terrain, coastlines and waterways.' ); ?>" fetchpriority="high" style="display:block;width:100%;height:auto"></div>
    <figcaption style="color:var(--muted);margin-top:12px"><?php echo esc_html( $art['caption'] ); ?></figcaption>
</figure>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:24px;margin-bottom:32px">
    <figure style="margin:0">
        <img src="<?php echo esc_url( home_url( $art['detail'] ) ); ?>" width="<?php echo (int) $art['detail_width']; ?>" height="<?php echo (int) $art['detail_height']; ?>" alt="<?php echo esc_attr( 'Terrain closeup from ' . $map['name'] . ' in Statefall.' ); ?>" loading="lazy" style="display:block;width:100%;height:auto;border-radius:14px">
        <figcaption style="margin-top:14px"><strong>Read the terrain</strong><p style="color:var(--muted);margin:6px 0 0">A closer look at the ground and waterways. Captured directly from gameplay.</p></figcaption>
    </figure>
    <figure style="margin:0">
        <img src="<?php echo esc_url( home_url( $art['overview'] ) ); ?>" width="<?php echo (int) $art['overview_width']; ?>" height="<?php echo (int) $art['overview_height']; ?>" alt="<?php echo esc_attr( 'Full strategic overview of the ' . $map['name'] . ' battlefield.' ); ?>" loading="lazy" style="display:block;width:100%;height:auto;border-radius:14px">
        <figcaption style="margin-top:14px"><strong>See the bigger picture</strong><p style="color:var(--muted);margin:6px 0 0">See how the closeup fits into the whole board. These gameplay views use seed <?php echo esc_html( $art['seed'] ); ?>.</p></figcaption>
    </figure>
</div>
