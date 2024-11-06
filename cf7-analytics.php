<?php
/**
 * Plugin Name: CF7 Analytics Dashboard
 * Description: Analytics dashboard for Contact Form 7 submissions with Gutenberg support
 * Version: 1.0
 * Author: Your Name
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

namespace CF7Analytics;

// Prevent direct access
if (!defined('ABSPATH')) {
    exit('Direct access denied.');
}

class CF7_Analytics_Dashboard {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_menu_page'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_ajax_get_form_data', array($this, 'handle_get_form_data'));
        
        error_log('CF7 Analytics: Class constructed');
    }

    public function enqueue_scripts($hook) {
        if ('toplevel_page_cf7-analytics' !== $hook) {
            return;
        }

        // WordPress core scripts
        wp_enqueue_script('jquery');
        wp_enqueue_script('heartbeat');
        wp_enqueue_script('wp-auth-check');

        // Chart.js
        wp_enqueue_script(
            'chartjs',
            'https://cdn.jsdelivr.net/npm/chart.js',
            array('jquery'),
            '3.7.0',
            true
        );

        // Plugin scripts
        wp_enqueue_script(
            'cf7-analytics',
            plugins_url('assets/js/cf7-analytics.js', __FILE__),
            array('jquery', 'chartjs', 'wp-auth-check'),
            filemtime(plugin_dir_path(__FILE__) . 'assets/js/cf7-analytics.js'),
            true
        );

        // Plugin styles
        wp_enqueue_style(
            'cf7-analytics',
            plugins_url('assets/css/cf7-analytics.css', __FILE__),
            array(),
            filemtime(plugin_dir_path(__FILE__) . 'assets/css/cf7-analytics.css')
        );

        // WordPress admin styles
        wp_enqueue_style('wp-admin');
        wp_enqueue_style('wp-auth-check');
        
        // Localize script
        wp_localize_script('cf7-analytics', 'cf7AnalyticsAjax', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('cf7_analytics_ajax_nonce'),
            'i18n' => array(
                'loading' => __('Carregando...', 'cf7-analytics'),
                'error' => __('Erro ao carregar dados', 'cf7-analytics'),
                'noData' => __('Nenhum dado encontrado', 'cf7-analytics')
            )
        ));
    }

    public function add_menu_page() {
        add_menu_page(
            'CF7 Analytics',
            'CF7 Analytics',
            'manage_options',
            'cf7-analytics',
            array($this, 'render_main_page'),
            'dashicons-chart-bar'
        );
    }

    public function render_main_page() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized access');
        }

        $forms = get_posts(array(
            'post_type' => 'wpcf7_contact_form',
            'posts_per_page' => -1,
            'orderby' => 'title',
            'order' => 'ASC'
        ));
        ?>
        <div class="wrap cf7-analytics-wrap">
            <h1><?php echo esc_html__('Contact Form 7 Analytics', 'cf7-analytics'); ?></h1>
            
            <!-- Container principal -->
            <div class="cf7-analytics-container">
                <!-- Lista de formulários -->
                <div class="cf7-forms-list">
                    <?php 
                    $forms = get_posts(array(
                        'post_type' => 'wpcf7_contact_form',
                        'posts_per_page' => -1,
                        'orderby' => 'title',
                        'order' => 'ASC'
                    ));

                    if (empty($forms)) {
                        echo '<div class="notice notice-warning"><p>' . 
                             esc_html__('Nenhum formulário encontrado.', 'cf7-analytics') . 
                             '</p></div>';
                    } else {
                        foreach ($forms as $form): 
                            ?>
                            <div class="form-item">
                                <h2>
                                    <a href="#" class="form-link" 
                                       data-form-id="<?php echo esc_attr($form->ID); ?>"
                                       data-nonce="<?php echo wp_create_nonce('view_form_' . $form->ID); ?>">
                                        <?php echo esc_html($form->post_title); ?>
                                    </a>
                                </h2>
                            </div>
                            <?php 
                        endforeach; 
                    }
                    ?>
                </div>

                <!-- Detalhes do formulário -->
                <div id="form-details" style="display: none;">
                    <!-- Loading indicator -->
                    <div id="form-loading" class="form-loading" style="display: none;">
                        <span class="spinner is-active"></span>
                        <span class="loading-text"><?php esc_html_e('Carregando...', 'cf7-analytics'); ?></span>
                    </div>

                    <!-- Conteúdo do Gutenberg -->
                    <div id="gutenberg-content" class="gutenberg-content card">
                        <div class="content-header"></div>
                        <div class="content-blocks"></div>
                    </div>

                    <!-- Gráficos -->
                    <div class="charts-wrapper card">
                        <div class="chart-container">
                            <h3><?php esc_html_e('Média das Avaliações', 'cf7-analytics'); ?></h3>
                            <div class="chart-area">
                                <canvas id="radar-chart"></canvas>
                            </div>
                        </div>
                        <div class="chart-container">
                            <h3><?php esc_html_e('Distribuição das Avaliações', 'cf7-analytics'); ?></h3>
                            <div class="chart-area">
                                <canvas id="bar-chart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tabela de submissões -->
                    <div class="submissions-table-container card">
                        <h3><?php esc_html_e('Submissões Detalhadas', 'cf7-analytics'); ?></h3>
                        <div class="table-responsive">
                            <table class="wp-list-table widefat fixed striped">
                                <thead>
                                    <tr>
                                        <th><?php esc_html_e('Nome do Aluno', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Email', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Pontualidade', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Plano de Ensino', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Comunicação', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Didática', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Motivação', 'cf7-analytics'); ?></th>
                                        <th><?php esc_html_e('Sugestões', 'cf7-analytics'); ?></th>
                                    </tr>
                                </thead>
                                <tbody id="submissions-data">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    public function handle_get_form_data() {
        error_log('CF7 Analytics: AJAX handler called');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Unauthorized access'));
            return;
        }

        if (!check_ajax_referer('cf7_analytics_ajax_nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => 'Security check failed'));
            return;
        }

        $form_id = isset($_POST['form_id']) ? absint($_POST['form_id']) : 0;
        error_log('Processando form_id: ' . $form_id);

        if (!$form_id) {
            wp_send_json_error(array('message' => 'Invalid form ID'));
            return;
        }

        // Busca dados do post
        $post_data = $this->find_post_with_form($form_id);
        error_log('Dados do post encontrados: ' . print_r($post_data, true));

        // Busca submissões
        $submissions = $this->get_form_submissions($form_id);
        error_log('Submissões encontradas: ' . count($submissions));

        wp_send_json_success(array(
            'submissions' => $submissions,
            'post_data' => $post_data
        ));
    }

    private function find_post_with_form($form_id) {
        global $wpdb;

        // Primeiro, pegamos o título do formulário CF7
        $cf7_form = get_post($form_id);
        if (!$cf7_form) {
            error_log('Formulário CF7 não encontrado');
            return null;
        }

        $form_title = $cf7_form->post_title;
        error_log('Procurando questionário com título: ' . $form_title);

        // Busca o questionário com o mesmo título
        $post = $wpdb->get_row($wpdb->prepare("
            SELECT * 
            FROM {$wpdb->posts} 
            WHERE post_type = 'questionario' 
            AND post_status = 'publish'
            AND post_title = %s
        ", $form_title));

        if (!$post) {
            error_log('Questionário não encontrado com título: ' . $form_title);
            return null;
        }

        error_log('Questionário encontrado - ID: ' . $post->ID . ', Título: ' . $post->post_title);

        // Parse blocks
        $blocks = parse_blocks($post->post_content);
        $parsed_content = array();

        foreach ($blocks as $block) {
            if (!empty($block['blockName'])) {
                $rendered = render_block($block);
                if (!empty($rendered)) {
                    $parsed_content[] = array(
                        'blockName' => $block['blockName'],
                        'content' => $rendered,
                        'attrs' => $block['attrs']
                    );
                    error_log('Bloco processado: ' . $block['blockName']);
                }
            } elseif (!empty($block['innerHTML'])) {
                $content = trim($block['innerHTML']);
                if (!empty($content)) {
                    $parsed_content[] = array(
                        'blockName' => 'core/classic-content',
                        'content' => wpautop($content),
                        'attrs' => array()
                    );
                    error_log('Conteúdo clássico processado');
                }
            }
        }

        // Retorna os dados formatados
        return array(
            'post_id' => $post->ID,
            'post_title' => $post->post_title,
            'post_type' => $post->post_type,
            'blocks' => $parsed_content
        );
    }

    private function get_form_submissions($form_id) {
        global $wpdb;
        
        $form_id = absint($form_id);
        $table_name = $wpdb->prefix . 'db7_forms';
        error_log('CF7 Analytics: Checking table ' . $table_name);

        // Verifica se a tabela existe
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'") == $table_name;
        error_log('CF7 Analytics: Table exists: ' . ($table_exists ? 'yes' : 'no'));

        if (!$table_exists) {
            return array();
        }

        $submissions = $wpdb->get_results($wpdb->prepare(
            "SELECT form_value, form_date 
             FROM {$table_name} 
             WHERE form_post_id = %d 
             ORDER BY form_date DESC",
            $form_id
        ));

        if (!$submissions) {
            return array();
        }

        $processed_data = array();
        foreach ($submissions as $submission) {
            $form_data = @unserialize($submission->form_value);
            
            if (!$form_data || !is_array($form_data)) {
                continue;
            }

            $processed_data[] = array(
                'nome' => isset($form_data['nome-aluno']) ? sanitize_text_field($form_data['nome-aluno']) : '',
                'email' => isset($form_data['email-aluno']) ? sanitize_email($form_data['email-aluno']) : '',
                'pontualidade' => isset($form_data['pontualidade'][0]) ? $form_data['pontualidade'][0] : '',
                'plano_ensino' => isset($form_data['plano-de-ensino'][0]) ? $form_data['plano-de-ensino'][0] : '',
                'comunicacao' => isset($form_data['comunicacao'][0]) ? $form_data['comunicacao'][0] : '',
                'didatica' => isset($form_data['didatica'][0]) ? $form_data['didatica'][0] : '',
                'motivacao' => isset($form_data['motivacao'][0]) ? $form_data['motivacao'][0] : '',
                'sugestoes' => isset($form_data['sugestoes']) ? sanitize_textarea_field($form_data['sugestoes']) : ''
            );
        }

        return $processed_data;
    }

    private function __clone() {}

    public function __wakeup() {}
}

function init_cf7_analytics() {
    CF7_Analytics_Dashboard::get_instance();
}

add_action('plugins_loaded', 'CF7Analytics\\init_cf7_analytics');